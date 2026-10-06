import { TYPE_LABEL, formatDateTime, timeAgo } from "@/lib/ui/format";

type Props = {
  type: keyof typeof TYPE_LABEL;
  title: string;
  courseLabel: string | null;
  detectedAt: Date;
  dueDate: Date | null;
  url: string | null;
  isNew: boolean;
};

export default function ActivityRow({ type, title, courseLabel, detectedAt, dueDate, url, isNew }: Props) {
  return (
    <li className="item">
      <span className={isNew ? "badge badge-new" : "badge"}>{isNew ? "New" : "Read"}</span>
      <div className="item-main">
        <p className="item-meta">{[courseLabel, TYPE_LABEL[type]].filter(Boolean).join(" · ")}</p>
        <p className="item-title">{url ? <a href={url} rel="noopener noreferrer" target="_blank">{title}</a> : title}</p>
        <p className="item-meta">
          Detected {timeAgo(detectedAt)}
          {dueDate ? ` · Due ${formatDateTime(dueDate)}` : ""}
        </p>
      </div>
    </li>
  );
}
