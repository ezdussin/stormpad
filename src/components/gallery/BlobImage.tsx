import { useEffect, useRef, type ImgHTMLAttributes } from 'react'

// The object URL is created and revoked in the same effect, so StrictMode's double mount never shows a revoked URL.
export function BlobImage({ blob, ...props }: { blob: Blob } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = ref.current
    if (!img) return
    const url = URL.createObjectURL(blob)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  return <img ref={ref} {...props} />
}
