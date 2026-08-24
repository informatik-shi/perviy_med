import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Личный кабинет абитуриента · ПСПбГМУ",
  description: "Интерактивный маршрут поступления на подготовительное отделение для иностранных граждан.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
