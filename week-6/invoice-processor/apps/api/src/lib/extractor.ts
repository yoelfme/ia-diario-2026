import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  invoiceExtractionResultSchema,
  standardCategorySlugSchema,
  type InvoiceExtractionResult,
} from '@invoice-processor/types';

export type InvoiceExtractor = (input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}) => Promise<InvoiceExtractionResult>;

const looseExtractionResultSchema = z.object({
  isInvoice: z.boolean(),
  rejectionReason: z.string().optional().default(''),
  invoice: z.object({
    consumerName: z.string(),
    consumerNit: z.string().nullable().optional(),
    producerName: z.string(),
    producerNit: z.string().nullable().optional(),
    categorySlug: standardCategorySlugSchema.nullable().optional(),
    invoiceDate: z.string().nullable().optional(),
    items: z.array(z.object({
      quantity: z.union([z.number(), z.string()]),
      description: z.string().optional().default(''),
      price: z.number(),
    })).optional().default([]),
    subtotal: z.number(),
    taxes: z.number(),
    total: z.number(),
  }).optional(),
});

function normalizeText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeInvoiceDate(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized ?? null;
}

function normalizeQuantity(value: string | number) {
  if (typeof value === 'number') {
    return value;
  }

  return Number(value.trim());
}

export function normalizeExtractionResult(
  value: z.infer<typeof looseExtractionResultSchema>,
): InvoiceExtractionResult {
  return invoiceExtractionResultSchema.parse({
    isInvoice: value.isInvoice,
    rejectionReason: value.rejectionReason,
    invoice: value.invoice ? {
      consumerName: value.invoice.consumerName.trim(),
      consumerNit: normalizeText(value.invoice.consumerNit),
      producerName: value.invoice.producerName.trim(),
      producerNit: normalizeText(value.invoice.producerNit),
      categorySlug: value.invoice.categorySlug ?? null,
      invoiceDate: normalizeInvoiceDate(value.invoice.invoiceDate),
      items: value.invoice.items.map((item) => {
        const quantity = normalizeQuantity(item.quantity);
        const description = item.description.trim();

        return {
          quantity,
          description: description.length > 0 ? description : 'SIN DESCRIPCION',
          price: item.price,
        };
      }),
      subtotal: value.invoice.subtotal,
      taxes: value.invoice.taxes,
      total: value.invoice.total,
    } : undefined,
  });
}

export function createOpenAiInvoiceExtractor(params: {
  apiKey: string;
  model: string;
}): InvoiceExtractor {
  const provider = createOpenAI({ apiKey: params.apiKey });
  const model = provider(params.model);

  return async ({ buffer, mimeType, filename }) => {
    const { object } = await generateObject({
      model,
      schema: looseExtractionResultSchema,
      system: [
        'Analiza el documento recibido y determina si contiene una factura.',
        'Si no es una factura, responde con isInvoice=false y un rejectionReason claro.',
        'Si sí es una factura, responde solamente con los campos del schema.',
        'Clasifica la factura usando categorySlug según los items detectados y elige solo una de estas categorías: alimentacion, transporte, hospedaje, suministros, servicios, impuestos, otros.',
        'La categoría debe inferirse principalmente a partir de las descripciones de los items y usar otros solo si ninguna categoría aplica claramente.',
        'Extrae invoiceDate usando el formato YYYY-MM-DD. Si la fecha no es legible, devuelve null.',
        'quantity debe ser un número entero positivo.',
        'Normaliza montos como números decimales positivos.',
        'Si un item no tiene descripción legible, devuelve description como cadena vacía.',
        'No inventes información que no sea visible en el documento.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Procesa este archivo (${filename}) y extrae la factura en formato estructurado.`,
            },
            {
              type: 'image',
              image: buffer,
              mediaType: mimeType,
            },
          ],
        },
      ],
    });

    return normalizeExtractionResult(object);
  };
}
