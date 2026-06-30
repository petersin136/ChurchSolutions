import Image from "next/image";
import styles from "./authCardLayout.module.css";

export function AuthBrand() {
  return (
    <div className={styles.brand}>
      <div className={styles.brandWordmark}>
        <Image
          src="/churchup-logo-black.png"
          alt="church up"
          width={1000}
          height={167}
          style={{ width: 200, height: "auto" }}
        />
      </div>
      <div className={styles.brandTagline}>
        <span className={styles.brandTaglineMuted}>행정은 가볍게 </span>
        <span className={styles.brandTaglineStrong}>시선은 목양에</span>
      </div>
    </div>
  );
}
