"use server";

import { createMessage } from "@/lib/db";

export type ContactState = {
  status: "bos" | "basarili" | "hata";
  message: string;
};

export async function sendMessage(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  // Bot tuzağı: gerçek kullanıcı bu alanı görmez ve doldurmaz.
  const trap = String(formData.get("website") ?? "");

  if (trap) return { status: "basarili", message: "Mesajınız alındı." };

  if (name.length < 2 || !email.includes("@") || body.length < 10) {
    return {
      status: "hata",
      message: "Adınızı, geçerli bir e-posta adresini ve en az bir cümlelik mesajı yazın.",
    };
  }

  await createMessage({
    name,
    email,
    subject: subject || "Konu belirtilmedi",
    body,
  });

  return {
    status: "basarili",
    message: "Mesajınız dükkâna ulaştı. Genellikle aynı gün, en geç 48 saat içinde yanıtlıyoruz.",
  };
}
