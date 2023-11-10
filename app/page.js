import Image from "next/image";
import Link from "next/link";

import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <div className={styles.description}>
        <div>
          Congratulations, you successfully deployed a Next.js app to Cloud Run
        </div>
      </div>

      <div className={styles.center}>
        <Image
          className={styles.logo}
          src="/celebration.svg"
          alt="Celebrate"
          width={427}
          height={231}
          priority
        />
      </div>

      <div className={styles.grid}>
        <Link href="./static" className={styles.card}>
          <h2>
            CDN <span>-&gt;</span>
          </h2>
          <p>
            Connect to Firebase Hosting to serve static and dynamic content
            using a global CDN
          </p>
        </Link>

        <a
          href="./isr"
          className={styles.card}
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2>
            Data Revalidation <span>-&gt;</span>
          </h2>
          <p>
            Ensure correct behavior from when using time-based or ondemand data
            revalidation strategies
          </p>
        </a>

        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className={styles.card}
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2>
            Image Optimization <span>-&gt;</span>
          </h2>
          <p>Explore the Next.js 13 playground.</p>
        </a>

        <a
          href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className={styles.card}
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2>
            Deploy <span>-&gt;</span>
          </h2>
          <p>
            Instantly deploy your Next.js site to a shareable URL with Vercel.
          </p>
        </a>
      </div>
    </>
  );
}
