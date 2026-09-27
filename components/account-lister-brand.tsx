"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./account-lister-brand.module.css";

export function AccountListerBrand({ businessName, logoUrl }: { businessName: string; logoUrl: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = businessName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return (
    <div className={styles.brand} role="img" aria-label={`${businessName} brand logo`}>
      {logoUrl && !imageFailed ? (
        <Image
          className={styles.logo}
          src={logoUrl}
          alt=""
          width={88}
          height={88}
          unoptimized
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={styles.initials} aria-hidden="true">{initials || "H"}</span>
      )}
    </div>
  );
}
