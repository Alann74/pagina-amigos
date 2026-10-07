"use client";

import NextImage, { type ImageProps } from "next/image";
import { useState } from "react";

const WEBP = /-w\d+\.webp$/;

/**
 * Igual que next/image, con respaldo: las fotos se sirven en WebP y cada una tiene también su versión JPG
 * (-share.jpg). Si el WebP no carga (equipos viejos sin WebP, como iOS 13 o Safari en macOS Catalina,
 * o un corte puntual), se muestra el JPG.
 */
export default function Image(props: ImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = typeof props.src === "string" ? props.src : null;
  if (src && failed === src && WEBP.test(src)) {
    return <NextImage {...props} src={src.replace(WEBP, "-share.jpg")} unoptimized onError={props.onError} />;
  }
  return (
    <NextImage
      {...props}
      onError={(e) => {
        if (src) setFailed(src);
        props.onError?.(e);
      }}
    />
  );
}
