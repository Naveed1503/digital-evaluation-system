import logo from "@/assets/evaluation-logo.png";

/** Decorative beside the visible product name; labelled when used alone. */
export function BrandLogo({ className = "h-10 w-10", labelled = false }: { className?: string; labelled?: boolean }) {
  return (
    <img
      src={logo}
      alt={labelled ? "Digital Evaluation System logo" : ""}
      width={280}
      height={280}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}