import Link from "next/link";
import NewNoteButton from "@/components/NewNoteButton";
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
  activityId?: string; // when given, the row offers a note about this item
  noteId?: string | null; // the note that already exists for it, if any
};

export default function ActivityRow({ type, lmsType, isMaterial, title, courseLabel, detectedAt, postedAt, dueDate, url, status, isUnread, isNew, large, activityId, noteId }: Props) {
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
        {noteId ? (
          <p className="item-meta"><Link href={`/notes/${noteId}`}>Open your note →</Link></p>
        ) : activityId ? (
          <NewNoteButton small label="+ Note" activityId={activityId} />
        ) : null}
      </div>
    </li>
  );
}
