#!/bin/bash

# Generate test pattern thumbnails using FFmpeg
OUTPUT_DIR="../frontend/public/test-patterns"
SIZE="320x180"
DURATION="1"

cd "$(dirname "$0")"
mkdir -p "$OUTPUT_DIR"

# SMPTE color bars
ffmpeg -f lavfi -i smptebars=size=$SIZE:duration=$DURATION -frames:v 1 -y "$OUTPUT_DIR/smpte.png"

# EBU color bars
ffmpeg -f lavfi -i smptebars=size=$SIZE:duration=$DURATION -frames:v 1 -y "$OUTPUT_DIR/ebu.png"

# HD color bars
ffmpeg -f lavfi -i smptehdbars=size=$SIZE:duration=$DURATION -frames:v 1 -y "$OUTPUT_DIR/hd.png"

# Grayscale
ffmpeg -f lavfi -i "color=gray:size=$SIZE:duration=$DURATION" -frames:v 1 -y "$OUTPUT_DIR/grayscale.png"

# Resolution test pattern
ffmpeg -f lavfi -i testsrc=size=$SIZE:duration=$DURATION -frames:v 1 -y "$OUTPUT_DIR/resolution.png"

# Solid color (white)
ffmpeg -f lavfi -i "color=white:size=$SIZE:duration=$DURATION" -frames:v 1 -y "$OUTPUT_DIR/solid.png"

# Gradient
ffmpeg -f lavfi -i "gradients=size=$SIZE:duration=$DURATION" -frames:v 1 -y "$OUTPUT_DIR/gradient.png"

# Checkerboard
ffmpeg -f lavfi -i testsrc2=size=$SIZE:duration=$DURATION -frames:v 1 -y "$OUTPUT_DIR/checkerboard.png"

# Noise
ffmpeg -f lavfi -i "nullsrc=s=$SIZE,geq=random(1)*255:128:128" -frames:v 1 -y "$OUTPUT_DIR/noise.png"

echo "Test pattern thumbnails generated in $OUTPUT_DIR"