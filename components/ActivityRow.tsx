import { type TYPE_LABEL, PENDING_LABEL, dueIn, formatDateTime, timeAgo, typeLabel } from "@/lib/ui/format";

type Props = {
  type: keyof typeof TYPE_LABEL;
  lmsType?: string | null;
  isMaterial?: boolean;
  title: string;
  courseLabel: string | null;
  detectedAt: Date;
  postedAt?: Date | null;
  dueDate: Date | null;
  url: string | null;
  // current state from the last check
  status?: string | null; // ASSIGNED, DUE_TODAY or MISSED while pending
  isUnread?: boolean;
  // true while the notification for it has not been marked as read
  isNew: boolean;
  large?: boolean;
};

export default function ActivityRow({ type, lmsType, isMaterial, title, courseLabel, detectedAt, postedAt, dueDate, url, status, isUnread, isNew, large }: Props) {
  const badgeText = status ? PENDING_LABEL[status] ?? status : isUnread ? "Unread" : "Read";
  const badgeClass =
    status === "MISSED" ? "badge badge-missed" : status === "DUE_TODAY" ? "badge badge-new" : status ? "badge badge-assigned" : "badge";
  const meta = [courseLabel, typeLabel(type, lmsType, isMaterial)].filter(Boolean).join(" · ");
  return (
    <li className={large ? "item item-large" : "item"}>
      <span className={badgeClass}>{badgeText}</span>
      <div className="item-main">
        <p className="item-meta">
          {isNew && <span className="new-tag">New</span>}
          {meta}
        </p>
        <p className="item-title">{url ? <a href={url} rel="noopener noreferrer" target="_blank">{title}</a> : title}</p>
        <p className="item-meta">
          {dueDate ? (
            <>
              Due {formatDateTime(dueDate)}
              {status ? ` · ${dueIn(dueDate)}` : ""}
            </>
          ) : postedAt ? (
            `Posted ${formatDateTime(postedAt)}`
          ) : (
            `Detected ${timeAgo(detectedAt)}`
          )}
        </p>
      </div>
    </li>
  );
}
