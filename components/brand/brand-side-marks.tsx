import Image from "next/image";

export function BrandSideMarks() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 left-0 right-0 z-0 hidden overflow-hidden xl:block"
    >
      <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-[0.12] 2xl:left-6 2xl:opacity-[0.15]">
        <div className="relative h-[36rem] w-[14rem] 2xl:h-[42rem] 2xl:w-[16rem]">
          <Image
            alt=""
            className="h-full w-full object-contain"
            fill
            sizes="(min-width: 1536px) 16rem, 14rem"
            src="/brand/gm-fantasy-vertical.png"
          />
        </div>
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-[0.12] 2xl:right-6 2xl:opacity-[0.15]">
        <div className="relative h-[36rem] w-[14rem] 2xl:h-[42rem] 2xl:w-[16rem]">
          <Image
            alt=""
            className="h-full w-full object-contain"
            fill
            sizes="(min-width: 1536px) 16rem, 14rem"
            src="/brand/gm-fantasy-vertical.png"
          />
        </div>
      </div>
    </div>
  );
}
