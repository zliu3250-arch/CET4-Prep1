import { EmptyState, SectionHeader } from '../../components/ui';

export default function ListeningPage() {
  return (
    <div>
      <SectionHeader title="听力训练" subtitle="倍速/回退 5 秒播放、原文对照，支持导入本地 MP3" />
      <EmptyState
        title="听力训练模块待开发"
        description="本目录（src/features/listening/）已预留给 /teamwork 的「听力训练 Agent」独立实现，请按 PRD.md 与 ARCHITECTURE.md 开发。"
      />
    </div>
  );
}
