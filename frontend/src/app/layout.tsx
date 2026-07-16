import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Varinth | AI Answer Audit Engine",
  description: "An MCP-native verification engine for engineering workflows",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
