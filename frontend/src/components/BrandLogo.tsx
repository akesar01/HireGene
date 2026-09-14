import Image from "next/image";

export default function BrandLogo({ size = 24 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt="SkipTheBoard"
      width={size}
      height={size}
      className="shrink-0"
    />
  );
}
