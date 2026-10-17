import { notFound } from "next/navigation"
import type { Product, Wilaya } from "@/lib/api-types"
import { getProductByHandleSafe, listProducts, listWilayas } from "@/lib/api"
import { pageMetadata } from "@/lib/seo"
import { ProductDetailView } from "@/components/product-detail-view"

async function loadProduct(handle: string): Promise<Product | null> {
  try {
    const product = await getProductByHandleSafe(handle)
    if (!product || product.status !== "published") return null
    return product
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const product = await loadProduct(handle)
  if (!product) {
    return pageMetadata({ path: `/products/${handle}` })
  }
  const image = product.thumbnail ?? product.images[0]?.url
  return pageMetadata({
    path: `/products/${product.handle}`,
    title: product.title,
    description: product.description ?? undefined,
    images: image ? [image] : undefined,
  })
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const product = await loadProduct(handle)

  if (!product) notFound()

  const category = product.categories[0]?.category

  let wilayas: Wilaya[] = []
  let relatedProducts: Product[] = []
  try {
    const [wilayaList, prodList] = await Promise.all([
      listWilayas(),
      listProducts({ status: "published", pageSize: 5 }),
    ])
    wilayas = wilayaList
    relatedProducts = prodList.data.filter((p) => p.handle !== product.handle).slice(0, 4)
  } catch {
    wilayas = []
    relatedProducts = []
  }

  return (
    <ProductDetailView
      product={product}
      wilayas={wilayas}
      category={category}
      relatedProducts={relatedProducts}
    />
  )
}
