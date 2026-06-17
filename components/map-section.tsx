'use client'

import React from 'react'

import { MapDirections, MapPlace } from '@/lib/types/map'

import { NativeIcon } from '@/components/native/native-icon'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './ui/collapsible'

interface MapSectionProps {
  state: 'searching' | 'complete'
  action?: 'search_places' | 'get_directions'
  provider?: 'google' | 'apple'
  query?: string
  places?: MapPlace[]
  origin?: string
  destination?: string
  directions?: MapDirections
}

function GoogleMapEmbed({
  query,
  origin,
  destination,
  apiKey
}: {
  query?: string
  origin?: string
  destination?: string
  apiKey?: string
}) {
  if (!apiKey) return null

  let src: string
  if (origin && destination) {
    src = `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
  } else if (query) {
    src = `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(query)}`
  } else {
    return null
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border shadow-md aspect-video">
      <iframe
        title="Map"
        src={src}
        className="w-full h-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  )
}

function AppleMapsLink({
  query,
  origin,
  destination
}: {
  query?: string
  origin?: string
  destination?: string
}) {
  let href: string
  let label: string

  if (origin && destination) {
    href = `https://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&dirflg=d`
    label = 'Open Directions in Apple Maps'
  } else if (query) {
    href = `https://maps.apple.com/?q=${encodeURIComponent(query)}`
    label = 'Open in Apple Maps'
  } else {
    return null
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
    >
      <NativeIcon name="externalLink" className="w-4 h-4" />
      {label}
    </a>
  )
}

function PlacesList({ places }: { places: MapPlace[] }) {
  if (!places.length)
    return <p className="text-sm text-muted-foreground">No places found.</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      {places.map((place, idx) => (
        <div
          key={place.id || idx}
          className="p-4 border rounded-xl bg-card text-card-foreground shadow-sm flex flex-col gap-1.5"
        >
          <div className="flex items-start gap-2">
            <NativeIcon
              name="mapPin"
              className="w-4 h-4 mt-0.5 text-primary flex-shrink-0"
            />
            <div>
              <h4 className="font-semibold text-sm">{place.name}</h4>
              <p className="text-xs text-muted-foreground leading-snug">
                {place.address}
              </p>
            </div>
          </div>
          {place.rating !== undefined && (
            <p className="text-xs ml-6 text-muted-foreground">
              ⭐ {place.rating} / 5
            </p>
          )}
          {place.phoneNumber && (
            <p className="text-xs ml-6 text-muted-foreground">
              {place.phoneNumber}
            </p>
          )}
          {place.url && (
            <a
              href={place.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs ml-6 text-primary hover:underline inline-flex items-center gap-1"
            >
              <NativeIcon name="externalLink" className="w-3 h-3" />
              Website
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function DirectionsPanel({ directions }: { directions: MapDirections }) {
  return (
    <div className="mt-3 flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center gap-6 p-3 rounded-xl border bg-muted/40">
        <div className="flex items-center gap-2">
          <NativeIcon name="ruler" className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{directions.distanceText}</span>
        </div>
        <div className="flex items-center gap-2">
          <NativeIcon name="clock" className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{directions.durationText}</span>
        </div>
      </div>
      {/* Step by step */}
      {directions.steps.length > 0 && (
        <ol className="flex flex-col gap-2 ml-1">
          {directions.steps.map((step, idx) => (
            <li key={idx} className="flex gap-3 text-sm text-foreground/80">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: step }} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function MapSection({
  state,
  action = 'search_places',
  provider = 'google',
  query,
  places = [],
  origin,
  destination,
  directions
}: MapSectionProps) {
  const [isOpen, setIsOpen] = React.useState(true)
  const googleApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const isSearching = state === 'searching'
  const isDirections = action === 'get_directions'

  const title = isSearching
    ? isDirections
      ? `Getting directions...`
      : `Searching map for "${query}"`
    : isDirections
      ? `Directions: ${origin} → ${destination}`
      : `Places near "${query}"`

  return (
    <div className="flex flex-col gap-2 w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer w-fit">
            <div className="p-2 bg-primary/10 rounded-full">
              {isDirections ? (
                <NativeIcon
                  name="navigation"
                  className="w-4 h-4 text-primary"
                />
              ) : (
                <NativeIcon name="map" className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{title}</span>
              <span className="text-xs text-muted-foreground capitalize">
                via {provider} Maps
              </span>
            </div>
          </div>
        </CollapsibleTrigger>

        {!isSearching && (
          <CollapsibleContent className="mt-4 flex flex-col gap-4">
            {/* Visual Map */}
            {provider === 'google' ? (
              <GoogleMapEmbed
                query={query}
                origin={origin}
                destination={destination}
                apiKey={googleApiKey}
              />
            ) : (
              <div className="flex items-center">
                <AppleMapsLink
                  query={query}
                  origin={origin}
                  destination={destination}
                />
              </div>
            )}

            {/* Directions details */}
            {isDirections && directions && (
              <DirectionsPanel directions={directions} />
            )}

            {/* Places list */}
            {!isDirections && places.length > 0 && (
              <PlacesList places={places} />
            )}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  )
}
