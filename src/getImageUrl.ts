export function getImageUrl(name: string, folder: string) {
  return new URL(`/src/assets/${folder}/${name}`, import.meta.url).href
}
