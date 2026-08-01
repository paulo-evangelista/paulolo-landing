import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ogImage from "./og_image.jpg";

const title = "paulolo.com";
const description = "Watching the ocean go by, one ASCII at a time";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL("https://paulolo.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title,
    description,
    siteName: title,
    images: [
      {
        url: ogImage.src,
        width: ogImage.width,
        height: ogImage.height,
        alt: title,
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [
      {
        url: ogImage.src,
        alt: title,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
