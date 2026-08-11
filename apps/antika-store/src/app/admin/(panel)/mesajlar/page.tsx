import type { Metadata } from "next";

import { removeMessage, toggleMessageRead } from "@/app/admin/(panel)/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Notice, PageHeader } from "@/components/admin/ui";
import { getMessages } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Mesajlar", robots: { index: false } };

export default async function AdminMessages({
  searchParams,
}: {
  searchParams: Promise<{ bildirim?: string }>;
}) {
  const { bildirim } = await searchParams;
  const messages = await getMessages();
  const unread = messages.filter((message) => !message.read).length;

  return (
    <>
      <PageHeader
        title="Mesajlar"
        description={`${messages.length} mesaj · ${unread} okunmamış`}
      />
      <Notice code={bildirim} />

      {messages.length === 0 ? (
        <div className="admin-box p-10 text-center text-ink-faint">
          Gelen kutusu boş.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`admin-box ${message.read ? "" : "border-l-4 border-l-brass"}`}
            >
              <div className="admin-box-body">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-medium text-ink">
                      {message.subject}
                      {message.read ? null : (
                        <span className="badge badge-beklemede ml-3">Yeni</span>
                      )}
                    </h2>
                    <p className="mt-1 text-sm text-ink-faint">
                      {message.name} ·{" "}
                      <a
                        href={`mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject)}`}
                        className="text-verdigris hover:underline"
                      >
                        {message.email}
                      </a>{" "}
                      · <span className="tnum">{formatDateTime(message.createdAt)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <form action={toggleMessageRead}>
                      <input type="hidden" name="id" value={message.id} />
                      <input type="hidden" name="read" value={String(message.read)} />
                      <button type="submit" className="admin-btn admin-btn-secondary">
                        {message.read ? "Okunmadı işaretle" : "Okundu işaretle"}
                      </button>
                    </form>
                    <form action={removeMessage}>
                      <input type="hidden" name="id" value={message.id} />
                      <ConfirmButton
                        className="admin-btn admin-btn-danger"
                        message="Mesaj silinecek. Emin misiniz?"
                      >
                        Sil
                      </ConfirmButton>
                    </form>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {message.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
