import Image from "next/image";

const shields = [
  { className: "left-[-3rem] top-[5rem] h-52 w-52 rotate-[-10deg] opacity-[0.09]" },
  { className: "left-[-2rem] bottom-[5rem] h-48 w-48 rotate-[14deg] opacity-[0.08]" },
  { className: "right-[-5rem] top-[10rem] h-64 w-64 rotate-[10deg] opacity-[0.09]" },
  { className: "right-[-3rem] bottom-[8rem] h-56 w-56 rotate-[-8deg] opacity-[0.08]" }
];

export function BrandSideMarks() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(60rem 40rem at 12% 18%, rgba(62, 146, 77, 0.22), transparent 60%)",
            "radial-gradient(52rem 36rem at 88% 24%, rgba(34, 108, 62, 0.18), transparent 62%)",
            "radial-gradient(70rem 48rem at 50% 110%, rgba(16, 74, 42, 0.18), transparent 65%)"
          ].join(", ")
        }}
      />
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-[0.5]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(14, 59, 33, 0.05) 0 2px, transparent 2px 12px)"
        }}
      />
      <div className="hidden xl:block">
        {shields.map((s, i) => (
          <div key={i} className={`absolute ${s.className}`}>
            <Image
              alt=""
              className="h-full w-full object-contain"
              fill
              sizes="288px"
              src="/brand/gm-fantasy-shield.png"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
