import type {
  AudioType,
  TestPattern,
  TestSourceBatch,
  TestSourceOptions,
  TestSourcePreset,
} from "@convconv/shared/types/testSource";
import {
  Button,
  Card,
  Collapse,
  Grid,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPlayerPlay, IconSettings } from "@tabler/icons-react";
import { useState } from "react";

interface TestPatternOption {
  value: TestPattern;
  label: string;
  thumbnail: string;
}

const testPatterns: TestPatternOption[] = [
  { value: "smpte", label: "SMPTE カラーバー", thumbnail: "/test-patterns/smpte.png" },
  { value: "ebu", label: "EBU カラーバー", thumbnail: "/test-patterns/ebu.png" },
  { value: "hd", label: "HD カラーバー", thumbnail: "/test-patterns/hd.png" },
  { value: "grayscale", label: "グレースケール", thumbnail: "/test-patterns/grayscale.png" },
  { value: "resolution", label: "解像度チャート", thumbnail: "/test-patterns/resolution.png" },
  { value: "solid", label: "単色", thumbnail: "/test-patterns/solid.png" },
  { value: "gradient", label: "グラデーション", thumbnail: "/test-patterns/gradient.png" },
  { value: "checkerboard", label: "チェッカーボード", thumbnail: "/test-patterns/checkerboard.png" },
  { value: "noise", label: "ノイズ", thumbnail: "/test-patterns/noise.png" },
];

const audioTypes: { value: AudioType; label: string }[] = [
  { value: "sine", label: "サイン波" },
  { value: "white-noise", label: "ホワイトノイズ" },
  { value: "pink-noise", label: "ピンクノイズ" },
  { value: "silence", label: "無音" },
];

const resolutions = [
  { value: "640x480", label: "SD (640×480)" },
  { value: "1280x720", label: "HD 720p (1280×720)" },
  { value: "1920x1080", label: "フルHD 1080p (1920×1080)" },
  { value: "3840x2160", label: "4K UHD (3840×2160)" },
  { value: "7680x4320", label: "8K UHD (7680×4320)" },
];

const formats = [
  { value: "mp4", label: "MP4" },
  { value: "mov", label: "MOV" },
  { value: "webm", label: "WebM" },
  { value: "mkv", label: "MKV" },
  { value: "avi", label: "AVI" },
  { value: "mxf", label: "MXF" },
];

interface TestSourceGeneratorProps {
  onGenerate: (options: TestSourceOptions, batch?: TestSourceBatch) => void;
  presets?: TestSourcePreset[];
}

export const TestSourceGenerator = ({ onGenerate, presets = [] }: TestSourceGeneratorProps) => {
  const [selectedPattern, setSelectedPattern] = useState<TestPattern>("smpte");
  const [resolution, setResolution] = useState("1920x1080");
  const [duration, setDuration] = useState(10);
  const [frameRate, setFrameRate] = useState(30);
  const [format, setFormat] = useState("mp4");

  // Audio settings
  const [audioType, setAudioType] = useState<AudioType>("sine");
  const [audioFrequency, setAudioFrequency] = useState(1000);
  const [audioChannel, setAudioChannel] = useState<"mono" | "stereo">("stereo");
  const [sampleRate, setSampleRate] = useState<44100 | 48000 | 96000>(48000);
  const [bitDepth, setBitDepth] = useState<16 | 24>(16);

  // Overlay settings
  const [showTimecode, setShowTimecode] = useState(false);
  const [showFrameCounter, setShowFrameCounter] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [customText, setCustomText] = useState("");

  // Batch settings
  const [enableBatch, setEnableBatch] = useState(false);
  const [batchResolutions, setBatchResolutions] = useState<string[]>([]);
  const [batchPatterns, setBatchPatterns] = useState<string[]>([]);
  const [batchFormats, setBatchFormats] = useState<string[]>([]);

  const handleGenerate = () => {
    const options: TestSourceOptions = {
      pattern: selectedPattern,
      resolution,
      duration,
      frameRate,
      format,
      audioType,
      audioFrequency: audioType === "sine" ? audioFrequency : undefined,
      audioChannel,
      sampleRate,
      bitDepth,
      showTimecode,
      showFrameCounter,
      showMetadata,
      customText: customText || undefined,
    };

    if (enableBatch && (batchResolutions.length > 0 || batchPatterns.length > 0 || batchFormats.length > 0)) {
      const batch: TestSourceBatch = {
        baseOptions: options,
        variations: {
          resolutions: batchResolutions.length > 0 ? batchResolutions : undefined,
          patterns: batchPatterns.length > 0 ? (batchPatterns as TestPattern[]) : undefined,
          formats: batchFormats.length > 0 ? batchFormats : undefined,
        },
      };
      onGenerate(options, batch);
    } else {
      onGenerate(options);
    }
  };

  const applyPreset = (preset: TestSourcePreset) => {
    const opts = preset.options;
    setSelectedPattern(opts.pattern);
    setResolution(opts.resolution);
    setDuration(opts.duration);
    setFrameRate(opts.frameRate || 30);
    setFormat(opts.format);
    setAudioType(opts.audioType);
    setAudioFrequency(opts.audioFrequency || 1000);
    setAudioChannel(opts.audioChannel);
    setSampleRate(opts.sampleRate);
    setBitDepth(opts.bitDepth);
    setShowTimecode(opts.showTimecode || false);
    setShowFrameCounter(opts.showFrameCounter || false);
    setShowMetadata(opts.showMetadata || false);
    setCustomText(opts.customText || "");
  };

  return (
    <Stack>
      <Title order={2}>テストソース生成</Title>

      {/* Presets */}
      {presets.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md">
          <Title order={4} mb="md">
            プリセット
          </Title>
          <SimpleGrid cols={3}>
            {presets.map((preset) => (
              <Button
                key={preset.id}
                variant="light"
                onClick={() => applyPreset(preset)}
                leftIcon={<IconSettings size={16} />}
              >
                {preset.name}
              </Button>
            ))}
          </SimpleGrid>
        </Card>
      )}

      {/* Test Pattern Selection */}
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={4} mb="md">
          テストパターン
        </Title>
        <SimpleGrid cols={3}>
          {testPatterns.map((pattern) => (
            <Card
              key={pattern.value}
              shadow={selectedPattern === pattern.value ? "md" : "xs"}
              padding="xs"
              radius="md"
              style={{
                cursor: "pointer",
                border: selectedPattern === pattern.value ? "2px solid #228be6" : "1px solid #e0e0e0",
              }}
              onClick={() => setSelectedPattern(pattern.value)}
            >
              <img
                src={pattern.thumbnail}
                alt={pattern.label}
                style={{ width: "100%", height: "auto", borderRadius: "4px" }}
              />
              <Text size="sm" align="center" mt="xs">
                {pattern.label}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Card>

      {/* Video Settings */}
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={4} mb="md">
          映像設定
        </Title>
        <Grid>
          <Grid.Col span={6}>
            <Select
              label="解像度"
              value={resolution}
              onChange={(value) => value && setResolution(value)}
              data={resolutions}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="出力フォーマット"
              value={format}
              onChange={(value) => value && setFormat(value)}
              data={formats}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <NumberInput
              label="長さ（秒）"
              value={duration}
              onChange={(value) => typeof value === "number" && setDuration(value)}
              min={1}
              max={3600}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <NumberInput
              label="フレームレート（fps）"
              value={frameRate}
              onChange={(value) => typeof value === "number" && setFrameRate(value)}
              min={1}
              max={120}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Audio Settings */}
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={4} mb="md">
          音声設定
        </Title>
        <Grid>
          <Grid.Col span={6}>
            <Select
              label="音声タイプ"
              value={audioType}
              onChange={(value) => value && setAudioType(value as AudioType)}
              data={audioTypes}
            />
          </Grid.Col>
          {audioType === "sine" && (
            <Grid.Col span={6}>
              <NumberInput
                label="周波数（Hz）"
                value={audioFrequency}
                onChange={(value) => typeof value === "number" && setAudioFrequency(value)}
                min={20}
                max={20000}
              />
            </Grid.Col>
          )}
          <Grid.Col span={6}>
            <Select
              label="チャンネル"
              value={audioChannel}
              onChange={(value) => value && setAudioChannel(value as "mono" | "stereo")}
              data={[
                { value: "mono", label: "モノラル" },
                { value: "stereo", label: "ステレオ" },
              ]}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="サンプリングレート"
              value={sampleRate.toString()}
              onChange={(value) => value && setSampleRate(Number(value) as 44100 | 48000 | 96000)}
              data={[
                { value: "44100", label: "44.1 kHz" },
                { value: "48000", label: "48 kHz" },
                { value: "96000", label: "96 kHz" },
              ]}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="ビット深度"
              value={bitDepth.toString()}
              onChange={(value) => value && setBitDepth(Number(value) as 16 | 24)}
              data={[
                { value: "16", label: "16ビット" },
                { value: "24", label: "24ビット" },
              ]}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Overlay Settings */}
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={4} mb="md">
          オーバーレイオプション
        </Title>
        <Stack>
          <Switch
            label="タイムコード表示"
            checked={showTimecode}
            onChange={(event) => setShowTimecode(event.currentTarget.checked)}
          />
          <Switch
            label="フレームカウンター表示"
            checked={showFrameCounter}
            onChange={(event) => setShowFrameCounter(event.currentTarget.checked)}
          />
          <Switch
            label="メタデータ表示"
            checked={showMetadata}
            onChange={(event) => setShowMetadata(event.currentTarget.checked)}
          />
          <TextInput
            label="カスタムテキスト"
            value={customText}
            onChange={(event) => setCustomText(event.currentTarget.value)}
            placeholder="オーバーレイに表示するテキストを入力"
            maxLength={100}
          />
        </Stack>
      </Card>

      {/* Batch Generation */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group position="apart" mb="md">
          <Title order={4}>バッチ生成</Title>
          <Switch
            checked={enableBatch}
            onChange={(event) => setEnableBatch(event.currentTarget.checked)}
            label="バッチモードを有効化"
          />
        </Group>
        <Collapse in={enableBatch}>
          <Stack>
            <MultiSelect
              label="追加解像度"
              description="複数の解像度を一括生成"
              data={resolutions}
              value={batchResolutions}
              onChange={setBatchResolutions}
              placeholder="バッチ生成する解像度を選択"
            />
            <MultiSelect
              label="追加パターン"
              description="複数のパターンを一括生成"
              data={testPatterns.map((p) => ({ value: p.value, label: p.label }))}
              value={batchPatterns}
              onChange={setBatchPatterns}
              placeholder="バッチ生成するパターンを選択"
            />
            <MultiSelect
              label="追加フォーマット"
              description="複数のフォーマットを一括生成"
              data={formats}
              value={batchFormats}
              onChange={setBatchFormats}
              placeholder="バッチ生成するフォーマットを選択"
            />
            {(batchResolutions.length > 0 || batchPatterns.length > 0 || batchFormats.length > 0) && (
              <Text size="sm" c="dimmed">
                {Math.max(1, batchResolutions.length || 1) *
                  Math.max(1, batchPatterns.length || 1) *
                  Math.max(1, batchFormats.length || 1)}{" "}
                バリエーションを生成します
              </Text>
            )}
          </Stack>
        </Collapse>
      </Card>

      {/* Generate Button */}
      <Group position="right">
        <Button size="lg" leftIcon={<IconPlayerPlay size={20} />} onClick={handleGenerate}>
          テストソースを生成
        </Button>
      </Group>
    </Stack>
  );
};
