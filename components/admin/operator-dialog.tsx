"use client"

import type { FormEvent, ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button, type ButtonProps } from "@/components/ui/button"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// The dialog frame every operator dialog shares: the FF Dialog at the Paper
// width (440px, 480px for the upload forms, 720px for the upload list), 28px padding, title +
// description, body, and a right-aligned action row. The body is a form so
// Enter submits.

export interface OperatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** The action row. */
  actions: ReactNode
  onSubmit?: () => void
  wide?: boolean
  /** The page list of "Seiten hinzufügen". */
  list?: boolean
}

export function OperatorDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  onSubmit,
  wide,
  list,
}: OperatorDialogProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit?.()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-7",
          list ? "max-w-[720px]" : wide ? "max-w-[480px]" : "max-w-[440px]"
        )}
      >
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-1.5">
            <DialogTitle className={typeClass("title", "compact")}>
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className={typeClass("body", "compact")}>
                {description}
              </DialogDescription>
            )}
          </div>
          {children}
          <div className="flex justify-end gap-2 pt-1">{actions}</div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CancelButton({
  onClick,
  children = "Abbrechen",
}: {
  onClick: () => void
  children?: ReactNode
}) {
  return (
    <Button type="button" variant="secondary" onClick={onClick}>
      {children}
    </Button>
  )
}

/** Primary in the destructive colour: the button paints its fill from --foreground. */
export function DangerButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="primary"
      className={cn("[--foreground:var(--destructive)]", className)}
      {...props}
    />
  )
}

/** A field label + content + optional hint, the Paper field stack. */
export function FieldBlock({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className={cn(typeClass("caption", "compact"), "text-muted-foreground")}
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          role="alert"
          className={cn(typeClass("caption", "compact"), "text-destructive")}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          className={cn(
            typeClass("caption", "compact"),
            "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className={cn(typeClass("caption", "compact"), "text-destructive")}
    >
      {children}
    </p>
  )
}
