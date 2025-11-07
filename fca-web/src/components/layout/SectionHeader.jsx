import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/components/ui/primitives.jsx'

export default function SectionHeader({
  eyebrow,
  title,
  titleAs: TitleTag = 'h1',
  description,
  media,
  actions,
  children,
  className = '',
  contentClassName = '',
  titleClassName = '',
  descriptionClassName = '',
}) {
  return (
    <Card
      className={cn(
        'border surface-main',
        className,
      )}
    >
      <CardContent className={cn('p-8', contentClassName)}>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-5 md:flex-row md:items-center md:gap-6">
            {media && <div className="shrink-0">{media}</div>}
            <div className="space-y-3">
              {eyebrow && (
                <p className="text-xs uppercase tracking-[0.4em] text-heading-subdued">
                  {eyebrow}
                </p>
              )}
              {title && (
                <TitleTag
                  className={cn(
                    'text-3xl md:text-4xl font-black text-heading-primary',
                    titleClassName,
                  )}
                >
                  {title}
                </TitleTag>
              )}
              {description && (
                <p className={cn('text-kpi-secondary text-base', descriptionClassName)}>
                  {description}
                </p>
              )}
              {children}
            </div>
          </div>
          {actions && (
            <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row md:items-center md:justify-end">
              {Array.isArray(actions) ? actions.map((action, index) => (
                <div key={index} className="w-full md:w-auto">
                  {action}
                </div>
              )) : (
                <div className="w-full md:w-auto">{actions}</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
