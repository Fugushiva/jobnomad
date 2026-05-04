import { useForm, type UseFormProps, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { type z } from 'zod'

/**
 * useZodForm — React Hook Form + Zod type-safe wrapper.
 *
 * Couples useForm with zodResolver so schema, types, and the form
 * instance are all inferred from a single Zod schema definition.
 *
 * Note: constrained to ZodType whose output extends FieldValues
 * (i.e. Record<string, unknown>) as required by react-hook-form.
 *
 * @example
 *   const schema = z.object({ email: z.string().email() })
 *   const form = useZodForm({ schema })
 *   // form.handleSubmit, form.formState.errors, etc.
 */
export function useZodForm<
  TSchema extends z.ZodType<FieldValues>,
>(
  props: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'> & {
    schema: TSchema
  }
) {
  const { schema, ...formProps } = props
  return useForm<z.infer<TSchema>>({
    ...formProps,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
  })
}
