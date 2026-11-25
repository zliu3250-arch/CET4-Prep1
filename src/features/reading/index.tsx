import { EmptyState, SectionHeader } from '../../components/ui';

export default function ReadingPage() {
  return (
    <div>
      <SectionHeader title="阅读理解" subtitle="仔细阅读 / 选词填空 / 长篇匹配，自动判分与原文定位" />
      <EmptyState
        title="阅读理解模块待开发"
        description="本目录（src/features/reading/）已预留给 /teamwork 的「阅读理解 Agent」独立实现，请按 PRD.md 与 ARCHITECTURE.md 开发。"
      />
    </div>
  );
}
