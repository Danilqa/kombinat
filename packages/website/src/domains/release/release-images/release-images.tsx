import type { ReleaseImage } from 'domains/release/types';

interface ReleaseImagesProps {
  images: ReleaseImage[];
}

// Phone screenshots come with a width in pixels and share a row, so on a phone they shrink rather
// than stack.
export function ReleaseImages({ images }: ReleaseImagesProps) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {images.map(({ src, alt, width }) => (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={width === null ? undefined : { maxWidth: width }}
          className={
            width === null
              ? 'min-h-20 w-full rounded-lg border border-line-faint bg-raised'
              : 'min-h-20 min-w-0 flex-1 basis-0 rounded-lg border border-line-faint bg-raised'
          }
        />
      ))}
    </div>
  );
}
