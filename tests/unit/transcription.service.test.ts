/**
 * Unit Tests for Transcription Service
 */

import {
  TranscriptionError,
  FileTooLargeError,
  UnsupportedFormatError,
} from '../../src/services/transcription.service';

// Mock dependencies
jest.mock('../../src/services/storage.service', () => ({
  storageService: {
    downloadFile: jest.fn(),
  },
}));

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('TranscriptionService', () => {
  let transcriptionService: any;
  let mockOpenAI: any;
  let mockStorageService: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Re-import to get fresh instances
    jest.isolateModules(() => {
      mockStorageService = require('../../src/services/storage.service').storageService;
      const OpenAI = require('openai').default;
      mockOpenAI = new OpenAI();
      transcriptionService = require('../../src/services/transcription.service').transcriptionService;
    });
  });

  describe('Custom Error Classes', () => {
    it('should create FileTooLargeError with correct message', () => {
      const error = new FileTooLargeError(30 * 1024 * 1024);
      expect(error).toBeInstanceOf(TranscriptionError);
      expect(error.message).toContain('25MB limit');
      expect(error.message).toContain('30 MB');
    });

    it('should create UnsupportedFormatError with correct message', () => {
      const error = new UnsupportedFormatError('xyz');
      expect(error).toBeInstanceOf(TranscriptionError);
      expect(error.message).toContain('Unsupported file format: xyz');
      expect(error.message).toContain('MP3, WAV');
    });
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe audio from S3 URL', async () => {
      // Mock S3 download
      const mockAudioBuffer = Buffer.from('fake audio data');
      mockStorageService.downloadFile.mockResolvedValue(mockAudioBuffer);

      // Mock Whisper API
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({
        text: 'This is the transcribed text from the audio.',
      });

      const result = await transcriptionService.transcribeAudio(
        'https://bucket.s3.amazonaws.com/profiles/user123/audio.mp3'
      );

      expect(result).toBe('This is the transcribed text from the audio.');
      expect(mockStorageService.downloadFile).toHaveBeenCalledWith(
        'profiles/user123/audio.mp3'
      );
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'whisper-1',
          language: 'en',
        })
      );
    });

    it('should throw FileTooLargeError for files exceeding 25MB', async () => {
      // Mock large file
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB
      mockStorageService.downloadFile.mockResolvedValue(largeBuffer);

      await expect(
        transcriptionService.transcribeAudio('s3://bucket/large-audio.mp3')
      ).rejects.toThrow(FileTooLargeError);
    });

    it('should retry on Whisper API failure', async () => {
      const mockAudioBuffer = Buffer.from('fake audio data');
      mockStorageService.downloadFile.mockResolvedValue(mockAudioBuffer);

      // First call fails, second succeeds
      mockOpenAI.audio.transcriptions.create
        .mockRejectedValueOnce(new Error('API temporarily unavailable'))
        .mockResolvedValueOnce({
          text: 'Transcription after retry',
        });

      const result = await transcriptionService.transcribeAudio(
        's3://bucket/audio.mp3'
      );

      expect(result).toBe('Transcription after retry');
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledTimes(2);
    });

    it('should handle S3 download failure', async () => {
      mockStorageService.downloadFile.mockRejectedValue(
        new Error('File not found')
      );

      await expect(
        transcriptionService.transcribeAudio('s3://bucket/missing.mp3')
      ).rejects.toThrow('File not found');
    });
  });

  describe('transcribe (universal method)', () => {
    beforeEach(() => {
      // Mock the individual methods
      transcriptionService.transcribeAudio = jest.fn().mockResolvedValue('Audio transcription');
      transcriptionService.transcribeVideo = jest.fn().mockResolvedValue('Video transcription');
    });

    it('should route MP3 files to transcribeAudio', async () => {
      const result = await transcriptionService.transcribe(
        's3://bucket/test.mp3'
      );

      expect(result).toBe('Audio transcription');
      expect(transcriptionService.transcribeAudio).toHaveBeenCalledWith(
        's3://bucket/test.mp3'
      );
      expect(transcriptionService.transcribeVideo).not.toHaveBeenCalled();
    });

    it('should route WAV files to transcribeAudio', async () => {
      await transcriptionService.transcribe('s3://bucket/test.wav');

      expect(transcriptionService.transcribeAudio).toHaveBeenCalled();
      expect(transcriptionService.transcribeVideo).not.toHaveBeenCalled();
    });

    it('should route MP4 files to transcribeVideo', async () => {
      const result = await transcriptionService.transcribe(
        's3://bucket/test.mp4'
      );

      expect(result).toBe('Video transcription');
      expect(transcriptionService.transcribeVideo).toHaveBeenCalledWith(
        's3://bucket/test.mp4'
      );
      expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
    });

    it('should route MOV files to transcribeVideo', async () => {
      await transcriptionService.transcribe('s3://bucket/test.mov');

      expect(transcriptionService.transcribeVideo).toHaveBeenCalled();
      expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
    });

    it('should throw UnsupportedFormatError for unknown extensions', async () => {
      await expect(
        transcriptionService.transcribe('s3://bucket/test.xyz')
      ).rejects.toThrow(UnsupportedFormatError);
    });

    it('should handle URLs without extensions', async () => {
      await expect(
        transcriptionService.transcribe('s3://bucket/noextension')
      ).rejects.toThrow(UnsupportedFormatError);
    });
  });

  describe('S3 key extraction', () => {
    it('should extract key from HTTPS URL', () => {
      const url = 'https://bucket.s3.amazonaws.com/profiles/user123/audio.mp3';
      // We'll test this indirectly through transcribeAudio
      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('data'));
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({ text: 'test' });

      transcriptionService.transcribeAudio(url);

      expect(mockStorageService.downloadFile).toHaveBeenCalledWith(
        'profiles/user123/audio.mp3'
      );
    });

    it('should extract key from s3:// URL', () => {
      const url = 's3://bucket/profiles/user123/audio.mp3';
      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('data'));
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({ text: 'test' });

      transcriptionService.transcribeAudio(url);

      expect(mockStorageService.downloadFile).toHaveBeenCalledWith(
        'profiles/user123/audio.mp3'
      );
    });

    it('should handle plain keys without protocol', () => {
      const key = 'profiles/user123/audio.mp3';
      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('data'));
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({ text: 'test' });

      transcriptionService.transcribeAudio(key);

      expect(mockStorageService.downloadFile).toHaveBeenCalledWith(
        'profiles/user123/audio.mp3'
      );
    });
  });
});
