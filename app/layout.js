import { Inter } from "next/font/google";
import styles from "./page.module.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Next.js on Google Cloud Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  );
}
