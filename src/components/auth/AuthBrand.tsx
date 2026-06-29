import styles from "./authCardLayout.module.css";

export function AuthBrand() {
  return (
    <div className={styles.brand}>
      <div className={styles.brandWordmark}>
        church u<span className={styles.brandUp}>p</span>
      </div>
      <div className={styles.brandTagline}>
        <span className={styles.brandTaglineMuted}>행정은 가볍게 </span>
        <span className={styles.brandTaglineStrong}>시선은 목양에</span>
      </div>
    </div>
  );
}
