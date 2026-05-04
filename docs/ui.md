# UI Component Guide — JobNomad

Design direction: **Sable lumineux** (luminous sand) — calm, warm, editorial.  
Full design spec: `style.pdf` (10 pages) and `JobNomad_Conception_Technique_v1.2.pdf` §8.2.

## Stack

| Layer | Package | Role |
|---|---|---|
| Primitives | shadcn/ui (new-york) | Radix + CVA-based components |
| Styling | Tailwind v4 | CSS-first, no config file |
| Icons | Lucide React | 1.5px stroke, tree-shakable |
| Animation | tw-animate-css | Tailwind v4 compatible |
| Theme | next-themes | dark/light/system, class-based |
| Forms | react-hook-form + Zod | Type-safe client validation |

---

## Design tokens (globals.css)

All tokens are OKLCh values registered in `@theme inline`. Use Tailwind semantic classes, never raw CSS vars inline in JSX.

### Colors

```
bg-bg          — page background
bg-surface     — card / elevated surfaces
bg-bg-tint     — subtle tinted background
text-text      — primary body text
text-text-soft — secondary supporting text
text-text-muted — tertiary / captions
text-primary   — lagoon (trust, high-match)
text-accent    — sun (warmth, mid-match)
text-danger    — coral (red flags only — use sparingly)
text-success   — green
bg-primary-soft / bg-accent-soft / bg-danger-soft — badge backgrounds
```

### Score palette

| Score | Color | Meaning | Class |
|---|---|---|---|
| 85–100 | Lagoon | Strong fit — apply | `score-high` / `bg-score-high-soft` |
| 60–84 | Sun | Read and decide | `score-mid` / `bg-score-mid-soft` |
| 0–59 | Coral | Skip | `score-low` / `bg-score-low-soft` |

Color jumps at 60 and 85 — **not a gradient**.

### Typography classes

```css
.text-display-2xl   /* 64px / Newsreader 300 — hero */
.text-display-xl    /* 48px / Newsreader 400 — major page title */
.text-display-lg    /* 36px / Newsreader 400 — section header */
.text-display-md    /* 28px / Newsreader 400 — card detail title */
.text-display-sm    /* 22px / Newsreader 400 — card feed title */
.text-body-xl       /* 18px / DM Sans 400 — lede */
.text-body-lg       /* 16px / DM Sans 400 — body */
.text-body-md       /* 14px / DM Sans 400 — UI default */
.text-body-sm       /* 13px / DM Sans 400 — small UI */
.text-label-md      /* 14px / DM Sans 500 — buttons, tabs */
.text-label-sm      /* 12px / DM Sans 500 — chips, tags */
.text-caption       /* 12px / DM Sans 400 — captions */
.text-overline      /* 11px / DM Sans 500 UPPERCASE — eyebrow */
.text-mono-sm       /* 12px / Geist Mono 500 — timestamps, IDs */
```

### Border radius

```
rounded-sm  — 6px  tags, chips
rounded-md  — 10px inputs, small buttons
rounded-lg  — 14px cards (default)
rounded-xl  — 18px large cards
rounded-2xl — 24px modals, hero cards
rounded-full — pills, avatars
```

---

## Component library

### Primitives (`components/ui/`)

Standard shadcn/ui components wired to JobNomad tokens. Use these for all atomic UI.

| Component | Usage |
|---|---|
| `<Button>` | `variant`: default, secondary, outline, ghost, destructive, link |
| `<Card>` + `CardHeader/Content/Footer` | All card-shaped containers |
| `<Input>` | Text/email inputs — `aria-invalid` supported |
| `<Label>` | Form labels |
| `<Badge>` | `variant`: default, secondary, outline, destructive, score-high/mid/low, red-flag |
| `<Select>` | Dropdown selects |
| `<Dialog>` / `<Sheet>` | Modals / side drawers |
| `<DropdownMenu>` | Action menus |
| `<Tabs>` | Tab navigation |
| `<Skeleton>` | Loading placeholders |
| `<Avatar>` | User avatars |
| `<Separator>` | Horizontal/vertical dividers |
| `<Form>` + fields | react-hook-form integration |
| `<Tooltip>` | Hover tooltips |
| `<Checkbox>` / `<Switch>` | Boolean inputs |
| `<Accordion>` | Collapsible sections |
| `<Progress>` | Progress bars |

### Brand (`components/brand/`)

```tsx
// Full lockup (mark + wordmark)
<Logo />                         // default, href="/"
<Logo variant="on-primary" />   // white on lagoon backgrounds
<Logo variant="mono-positive" /> // single color
<Logo size={40} />              // 20/28/40/56/80px
<Logo asDiv label="JobNomad" />  // no link, role="img"

// Mark only
<LogoMark variant="default" size={28} />
```

**Never** skew, stretch, or recolor the sun outside the accent palette.

### Layout (`components/layout/`)

```tsx
<Header variant="public" />                      // landing + auth pages
<Header variant="app" userEmail="u@x.com" />    // authenticated pages
<Footer />                                       // full footer
<Footer variant="minimal" />                    // compact inline
```

**Header** includes:
- Skip link → `#main` (keyboard/SR users)
- Theme toggle (dark/light/system)
- Mobile Sheet (hamburger)
- `<nav aria-label="Main navigation">`

Your page layout:
```tsx
<div className="flex flex-col flex-1 bg-bg text-text">
  <Header variant="public" />
  <main id="main" className="flex flex-col flex-1">
    {/* page content */}
  </main>
  <Footer />
</div>
```

### Jobs (`components/jobs/`)

```tsx
<JobCard job={jobData} variant="feed" onBookmark={handleBookmark} />
<JobCard job={jobData} variant="detail" />
<ScoreBadge score={92} />
<RedFlagBadge reason="Salary not disclosed" label="No salary" />
<JobCardSkeleton />
<JobCardSkeleton variant="detail" />
```

`JobCard` accepts `JobCardData` typed via Zod (`jobCardSchema`). Always validate API responses against this schema before rendering.

### Feed (`components/feed/`)

```tsx
<FeedSkeleton count={5} />  // animated loading state
```

### States (`components/states/`)

```tsx
<EmptyState
  icon={Bookmark}
  heading="No saved jobs yet"
  description="Bookmark jobs from your feed to review later."
  action={{ label: "Browse jobs", href: "/feed" }}
/>

<ErrorState
  heading="Could not load jobs"
  description="Check your connection and try again."
  onRetry={() => router.refresh()}
/>
```

---

## Forms with Zod

```tsx
// Option 1: shadcn <Form> + react-hook-form
import { useZodForm } from '@/lib/forms/use-zod-form'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

const schema = z.object({ email: z.string().email() })
const form = useZodForm({ schema })

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField name="email" control={form.control} render={({ field }) => (
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl><Input type="email" {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <Button type="submit">Submit</Button>
  </form>
</Form>

// Option 2: progressive enhancement with Server Actions
// See app/auth/login/login-form.tsx for reference
```

---

## Accessibility requirements

- Every page must have `<main id="main">` (skip link target)
- All images: `alt` text or `aria-hidden="true"`
- Icon-only buttons: `aria-label` required
- `<article>` for job cards: `aria-label="<title> at <company>"`
- Modals/sheets: `<DialogTitle>` / `<SheetTitle>` always present
- Contrast: use the tokens above — do not deviate without running contrast tests
- Focus ring: `focus-visible:ring-2 focus-visible:ring-ring` — never remove without adding a custom ring

Run contrast tests: `npm test src/lib/__tests__/ui/contrast.test.ts`

---

## Security rules

| Rule | Rationale |
|---|---|
| Never use `dangerouslySetInnerHTML` | XSS risk |
| External links: `rel="noopener noreferrer"` | Tabnapping prevention |
| Server Actions validate inputs with Zod | Defense in depth |
| `JobCardData` contains no PII | Only public job fields |
| No `process.env` in client components | Env leakage prevention |

---

## Adding a new component

1. **Primitive** (atomic, no business logic) → `components/ui/my-component.tsx`
2. **Domain** (business logic) → `components/<domain>/my-component.tsx`
3. Add a `__tests__/my-component.test.tsx` with at minimum: render, aria roles, keyboard interactions
4. Use `cn()` from `@/lib/utils` for class merging — never raw string concatenation
5. Use `cva()` for variants — never conditional `className` strings

---

## Theming

next-themes is configured with `defaultTheme="dark"`. The user's choice is persisted in localStorage.

The `ThemeToggle` in `<Header>` cycles dark → light → system. If you need the current theme in a component:

```tsx
import { useTheme } from 'next-themes'
const { theme, setTheme } = useTheme()  // 'dark' | 'light' | 'system'
```

Dark mode class is `.dark` on `<html>`. All tokens automatically switch via `.dark { ... }` in `globals.css`.
