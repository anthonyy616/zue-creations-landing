// Video poster frame generation using ffmpeg-static.
// Extracts a single frame from a video and uploads it to R2 as a poster.

import { execSync } from "node:child_process";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import ffmpegStatic from "ffmpeg-static";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import sharp from "sharp";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * Generate a poster image from a video file stored in R2.
 *
 * Extracts a frame ~2 seconds into the video (or the first frame if shorter),
 * converts it to a WebP poster, and uploads it to R2.
 *
 * @param videoKey - The R2 storage key of the video (e.g. "media/uuid-slug.mp4")
 * @returns The R2 key of the generated poster, or null if generation failed.
 */
export async function generateVideoPoster(videoKey: string): Promise<string | null> {
  // Derive poster key from video key: replace extension with -poster.webp
  const dot = videoKey.lastIndexOf(".");
  const base = dot === -1 ? videoKey : videoKey.slice(0, dot);
  const posterKey = `${base}-poster.webp`;

  try {
    // Download video from R2 to a temp file
    const videoBuffer = await downloadFromR2(videoKey);

    // Write to temp file for ffmpeg
    const tempDir = os.tmpdir();
    const videoPath = path.join(tempDir, `video-${Date.now()}.tmp`);
    const posterPath = path.join(tempDir, `poster-${Date.now()}.webp`);

    fs.writeFileSync(videoPath, videoBuffer);

    try {
      // Extract frame at 2 seconds (or 1 second if video is shorter)
      // Use -ss before -i for fast seeking, then -frames:v 1 for single frame
      const ff = ffmpegStatic;
      if (!ff) {
        console.warn("ffmpeg-static not available, cannot generate video poster");
        return null;
      }

      // First try to get video duration to pick a good frame time
      let seekTime = "2";
      try {
        const probeOutput = execSync(`"${ff}" -i "${videoPath}" -show_entries format=duration -v quiet -of csv="p=0"`, {
          encoding: "utf-8",
          timeout: 10000,
        });
        const duration = parseFloat(probeOutput.trim());
        if (!isNaN(duration) && duration > 0) {
          // Use 10% of duration or 2 seconds, whichever is less, but at least 0.5s
          seekTime = Math.min(duration * 0.1, 2).toString();
          if (parseFloat(seekTime) < 0.5) seekTime = "0.5";
        }
      } catch {
        // If we can't probe, default to 2 seconds
      }

      // Extract frame
      execSync(
        `"${ff}" -y -ss ${seekTime} -i "${videoPath}" -frames:v 1 -vf "scale=1920:-1:flags=lanczos" -quality 80 -compression_pipeline 1 "${posterPath}"`,
        { timeout: 30000, stdio: "pipe" }
      );

      // Read the generated poster and convert to WebP if needed
      if (!fs.existsSync(posterPath)) {
        console.warn("ffmpeg did not produce output file");
        return null;
      }

      let posterBuffer = fs.readFileSync(posterPath);

      // Ensure it's WebP (ffmpeg might output PNG/JPEG depending on codec)
      const ext = path.extname(posterPath).toLowerCase();
      if (ext !== ".webp") {
        posterBuffer = await sharp(posterBuffer).webp({ quality: 80 }).toBuffer();
      }

      // Upload to R2
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: posterKey,
          Body: posterBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      return posterKey;
    } finally {
      // Clean up temp files
      try { fs.unlinkSync(videoPath); } catch {}
      try { fs.unlinkSync(posterPath); } catch {}
    }
  } catch (err) {
    console.error("Failed to generate video poster:", err);
    return null;
  }
}

async function downloadFromR2(key: string): Promise<Buffer> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const res = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("Empty object returned from R2");
  return Buffer.from(bytes);
}
