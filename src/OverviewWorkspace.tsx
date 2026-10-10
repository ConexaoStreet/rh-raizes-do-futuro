import SectorWorkspace from "./SectorWorkspace";
export default function OverviewWorkspace({
  instructor = false,
}: {
  instructor?: boolean;
}) {
  return <SectorWorkspace overview instructor={instructor} />;
}
