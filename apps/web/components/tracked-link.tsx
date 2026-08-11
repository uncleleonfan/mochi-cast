'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

type Props = {
  /** GA event action name */
  eventAction: string;
  /** GA event category */
  eventCategory: string;
  /** GA event label (optional) */
  eventLabel?: string;
} & (
  | {
      variant: 'a';
      href: string;
      target?: string;
      rel?: string;
      className?: string;
      onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
      children: React.ReactNode;
    }
  | {
      variant: 'link';
      href: string;
      className?: string;
      onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
      children: React.ReactNode;
    }
);

export function TrackedLink(props: Props) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackEvent(props.eventAction, props.eventCategory, props.eventLabel);
    props.onClick?.(e);
  };

  if (props.variant === 'link') {
    const { variant: _, eventAction: __, eventCategory: ___, eventLabel: ____, ...rest } = props;
    return <Link {...rest} onClick={handleClick} />;
  }

  const { variant: _, eventAction: __, eventCategory: ___, eventLabel: ____, ...rest } = props;
  return <a {...rest} onClick={handleClick} />;
}
