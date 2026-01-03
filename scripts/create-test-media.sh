#!/bin/bash

# Create sample video and audio files for testing
# This script creates minimal valid media files for testing purposes

set -e

echo "🎬 Creating Sample Test Media Files"
echo "====================================="

# Create test-data directories
mkdir -p test-data/videos
mkdir -p test-data/audio

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: ffmpeg is not installed"
    echo ""
    echo "Please install ffmpeg:"
    echo "  macOS:         brew install ffmpeg"
    echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  Windows:       Download from https://ffmpeg.org/download.html"
    exit 1
fi

echo ""
echo "✓ ffmpeg found"
echo ""

# Pick a TTS tool if available (prefer system voice over tone)
TTS_CMD=""
if command -v say >/dev/null 2>&1; then
    TTS_CMD="say"
elif command -v espeak >/dev/null 2>&1; then
    TTS_CMD="espeak"
fi

VOICE_TEXT="This is a sample teacher response for assessment testing."
TEMP_VOICE_WAV="test-data/audio/tmp-voice.wav"
TEMP_VOICE_AIFF="test-data/audio/tmp-voice.aiff"

generate_voice() {
    if [ "$TTS_CMD" = "say" ]; then
        # macOS say outputs AIFF; convert to WAV for ffmpeg pipeline
        say -o "$TEMP_VOICE_AIFF" "$VOICE_TEXT"
        ffmpeg -y -i "$TEMP_VOICE_AIFF" -ar 44100 -ac 2 "$TEMP_VOICE_WAV" -loglevel error
    elif [ "$TTS_CMD" = "espeak" ]; then
        espeak -w "$TEMP_VOICE_WAV" "$VOICE_TEXT"
    else
        echo "⚠️  No TTS tool found (say/espeak). Please record a short voice clip at test-data/audio/sample-response.mp3 and re-run." >&2
        return 1
    fi
}

# Generate voice clip (or fail early with guidance)
if ! generate_voice; then
    exit 1
fi

# Create a 5-second video with spoken audio
echo "📹 Creating sample video with speech (5 seconds)..."

# First, create silent video with text overlay
ffmpeg -f lavfi -i "color=c=black:s=640x480:d=5" \
    -vf "drawtext=text='Sample Assessment Response':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
    -t 5 \
    -y test-data/videos/temp-video.mp4 \
    -loglevel error

# Then, merge video with audio
ffmpeg -i test-data/videos/temp-video.mp4 \
    -i "$TEMP_VOICE_WAV" \
    -c:v copy \
    -c:a aac -b:a 128k \
    -t 5 \
    -movflags +faststart \
    -y test-data/videos/sample-response.mp4 \
    -loglevel error

# Cleanup temp video
rm -f test-data/videos/temp-video.mp4

if [ -f test-data/videos/sample-response.mp4 ]; then
        SIZE=$(du -h test-data/videos/sample-response.mp4 | cut -f1)
        echo "✓ Video created: test-data/videos/sample-response.mp4 (${SIZE})"
else
        echo "❌ Failed to create video"
        exit 1
fi

echo ""

# Create a 7-second sample audio with spoken content
echo "🎵 Creating sample audio with speech (7 seconds)..."
ffmpeg -i "$TEMP_VOICE_WAV" \
             -af "apad=pad_dur=2" \
             -c:a libmp3lame -b:a 128k \
             -y test-data/audio/sample-response.mp3 \
             -loglevel error

if [ -f test-data/audio/sample-response.mp3 ]; then
        SIZE=$(du -h test-data/audio/sample-response.mp3 | cut -f1)
        echo "✓ Audio created: test-data/audio/sample-response.mp3 (${SIZE})"
else
        echo "❌ Failed to create audio"
        exit 1
fi

# Cleanup temp voice files
rm -f "$TEMP_VOICE_WAV" "$TEMP_VOICE_AIFF"

echo ""
echo "====================================="
echo "✅ Sample media files created successfully!"
echo ""
echo "Files created:"
echo "  - test-data/videos/sample-response.mp4"
echo "  - test-data/audio/sample-response.mp3"
echo ""
echo "You can now run:"
echo "  pnpm test:competency-flow"
echo "  pnpm test:pd-flow"
