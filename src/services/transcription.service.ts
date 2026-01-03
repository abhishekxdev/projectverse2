/**
 * Transcription Service
 * Handles audio/video transcription using OpenAI Whisper API
 */

import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { storageService } from './storage.service';
import { logger } from '../utils/logger';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Constants
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit
const EXTRACTION_TIMEOUT_MS = 30000; // 30 seconds
const RETRY_DELAY_MS = 2000; // 2 seconds

/**
 * Custom error classes for transcription
 */
export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export class FileTooLargeError extends TranscriptionError {
  constructor(size: number) {
    super(
      `File size (${formatBytes(size)}) exceeds the 25MB limit. Please use a shorter recording (max ~15 minutes).`
    );
    this.name = 'FileTooLargeError';
  }
}

export class UnsupportedFormatError extends TranscriptionError {
  constructor(format: string) {
    super(
      `Unsupported file format: ${format}. Supported formats: MP3, WAV, M4A, WebM, MPEG for audio; MP4, MOV, WebM, AVI, MKV for video.`
    );
    this.name = 'UnsupportedFormatError';
  }
}

export class TranscriptionFailedError extends TranscriptionError {
  constructor(message: string) {
    super(`Transcription failed: ${message}`);
    this.name = 'TranscriptionFailedError';
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Transcription Service
 */
class TranscriptionService {
  /**
   * Extract S3 key from URL or return as-is if already a key
   */
  private extractS3Key(s3UrlOrKey: string): string {
    // If it's already a key (no protocol), return as-is
    if (!s3UrlOrKey.includes('://')) {
      return s3UrlOrKey;
    }

    // Extract key from URL
    // Format: https://bucket.s3.amazonaws.com/key or s3://bucket/key
    try {
      if (s3UrlOrKey.startsWith('s3://')) {
        // s3://bucket/key -> key
        const parts = s3UrlOrKey.substring(5).split('/');
        return parts.slice(1).join('/');
      } else if (s3UrlOrKey.startsWith('http')) {
        // https://bucket.s3.amazonaws.com/key -> key
        const url = new URL(s3UrlOrKey);
        return url.pathname.substring(1); // Remove leading /
      }
    } catch (error) {
      logger.error('Failed to parse S3 URL:', error instanceof Error ? error : new Error(String(error)), {
        url: s3UrlOrKey,
      });
    }

    // Fallback: return as-is
    return s3UrlOrKey;
  }

  /**
   * Transcribe audio file from S3
   */
  async transcribeAudio(s3Url: string): Promise<string> {
    const startTime = Date.now();

    try {
      logger.info('Starting audio transcription', { s3Url });

      // Extract S3 key
      const key = this.extractS3Key(s3Url);

      // Download file from S3
      const audioBuffer = await storageService.downloadFile(key);

      // Validate file size
      if (audioBuffer.length > MAX_FILE_SIZE) {
        throw new FileTooLargeError(audioBuffer.length);
      }

      logger.info('Audio downloaded, transcribing with Whisper', {
        size: formatBytes(audioBuffer.length),
      });

      // Call Whisper API with retry
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // Create a file-like object from buffer using Blob
          // Convert Buffer to Uint8Array for compatibility
          const uint8Array = new Uint8Array(audioBuffer);
          const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
          const file = new File([blob], 'audio.mp3', {
            type: 'audio/mpeg',
          });

          const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'en',
          });

          const duration = Date.now() - startTime;
          const estimatedCost = (audioBuffer.length / (1024 * 1024 * 60)) * 0.006;

          logger.info('Audio transcription completed', {
            duration: `${duration}ms`,
            textLength: transcription.text.length,
            estimatedCost: `$${estimatedCost.toFixed(4)}`,
          });

          return transcription.text;
        } catch (error) {
          lastError = error as Error;

          if (attempt === 0) {
            logger.warn('Whisper API call failed, retrying...', {
              error: lastError.message,
            });
            await sleep(RETRY_DELAY_MS);
          }
        }
      }

      // All retries failed
      throw new TranscriptionFailedError(
        lastError?.message || 'Unknown error after retries'
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Audio transcription failed', error instanceof Error ? error : new Error(String(error)), {
        duration: `${duration}ms`,
      });

      throw error;
    }
  }

  /**
   * Extract audio from video buffer using ffmpeg
   */
  async extractAudioFromVideo(videoBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const startTime = Date.now();

      logger.info('Extracting audio from video', {
        videoSize: formatBytes(videoBuffer.length),
      });

      // Create readable stream from buffer
      const videoStream = Readable.from(videoBuffer);

      // Set up timeout
      const timeout = setTimeout(() => {
        logger.error('Audio extraction timeout');
        reject(
          new TranscriptionError(
            'Audio extraction took too long. Please use a shorter video (max 15 minutes).'
          )
        );
      }, EXTRACTION_TIMEOUT_MS);

      try {
        ffmpeg(videoStream)
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .format('mp3')
          .on('start', (commandLine: string) => {
            logger.info('FFmpeg started', { command: commandLine });
          })
          .on('end', () => {
            clearTimeout(timeout);
            const audioBuffer = Buffer.concat(chunks);
            const duration = Date.now() - startTime;

            logger.info('Audio extraction completed', {
              duration: `${duration}ms`,
              audioSize: formatBytes(audioBuffer.length),
            });

            resolve(audioBuffer);
          })
          .on('error', (error: Error) => {
            clearTimeout(timeout);

            logger.error('Audio extraction failed', error);

            reject(
              new TranscriptionError(
                `Failed to extract audio from video: ${error.message}`
              )
            );
          })
          .pipe()
          .on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
      } catch (error) {
        clearTimeout(timeout);

        logger.error('FFmpeg setup failed', error instanceof Error ? error : new Error(String(error)));

        reject(
          new TranscriptionError(
            `Failed to set up audio extraction: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  /**
   * Transcribe video file (extract audio then transcribe)
   */
  async transcribeVideo(s3Url: string): Promise<string> {
    const startTime = Date.now();

    try {
      logger.info('Starting video transcription', { s3Url });

      // Extract S3 key
      const key = this.extractS3Key(s3Url);

      // Download video from S3
      const videoBuffer = await storageService.downloadFile(key);

      logger.info('Video downloaded, extracting audio', {
        size: formatBytes(videoBuffer.length),
      });

      // Extract audio track
      const audioBuffer = await this.extractAudioFromVideo(videoBuffer);

      // Validate extracted audio size
      if (audioBuffer.length > MAX_FILE_SIZE) {
        throw new FileTooLargeError(audioBuffer.length);
      }

      logger.info('Audio extracted, transcribing with Whisper', {
        audioSize: formatBytes(audioBuffer.length),
      });

      // Transcribe audio
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // Create a file-like object from buffer using Blob
          // Convert Buffer to Uint8Array for compatibility
          const uint8Array = new Uint8Array(audioBuffer);
          const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
          const file = new File([blob], 'audio.mp3', {
            type: 'audio/mpeg',
          });

          const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'en',
          });

          const duration = Date.now() - startTime;
          const estimatedCost = (audioBuffer.length / (1024 * 1024 * 60)) * 0.006;

          logger.info('Video transcription completed', {
            duration: `${duration}ms`,
            textLength: transcription.text.length,
            estimatedCost: `$${estimatedCost.toFixed(4)}`,
          });

          return transcription.text;
        } catch (error) {
          lastError = error as Error;

          if (attempt === 0) {
            logger.warn('Whisper API call failed, retrying...', {
              error: lastError.message,
            });
            await sleep(RETRY_DELAY_MS);
          }
        }
      }

      // All retries failed
      throw new TranscriptionFailedError(
        lastError?.message || 'Unknown error after retries'
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Video transcription failed', error instanceof Error ? error : new Error(String(error)), {
        duration: `${duration}ms`,
      });

      throw error;
    }
  }

  /**
   * Universal transcription method - auto-detects file type
   */
  async transcribe(s3Url: string): Promise<string> {
    // Detect file type from extension
    const extension = s3Url.split('.').pop()?.toLowerCase() || '';

    const audioFormats = ['mp3', 'wav', 'm4a', 'webm', 'mpeg', 'mpga'];
    const videoFormats = ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv'];

    if (audioFormats.includes(extension)) {
      logger.info('Detected audio file', { extension });
      return this.transcribeAudio(s3Url);
    } else if (videoFormats.includes(extension)) {
      logger.info('Detected video file', { extension });
      return this.transcribeVideo(s3Url);
    } else {
      throw new UnsupportedFormatError(extension);
    }
  }
}

export const transcriptionService = new TranscriptionService();
