import React, { useMemo, useState } from 'react'
import {
  CONTRACT_HIGHLIGHT_COLOR,
  ECONOMY_HEAT_COLORS,
  EVENT_PULSE_COLOR,
  HOME_RING_COLOR,
  NPC_CONVOY_COLOR
} from '../../shared/starMap'
import type { StarMapView } from '../../shared/types'
import { computeMapViewBox, shouldShowLabel, transportArcPosition } from '../starMapLayout'

export interface StarMapNetworkProps {
  map: StarMapView
  selectedSystemId: string | null
  showLanes: boolean
  showTransportArcs: boolean
  showNpcConvoys: boolean
  showAllLabels: boolean
  onSelectSystem: (id: string) => void
}

const NODE_RADIUS = 8
const LABEL_OFFSET_Y = -14

export function StarMapNetwork({
  map,
  selectedSystemId,
  showLanes,
  showTransportArcs,
  showNpcConvoys,
  showAllLabels,
  onSelectSystem
}: StarMapNetworkProps): React.JSX.Element {
  const [hoveredSystemId, setHoveredSystemId] = useState<string | null>(null)

  const viewBox = useMemo(() => computeMapViewBox(map.systems), [map.systems])
  const viewBoxStr = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`

  return (
    <svg
      className="star-map-svg"
      data-testid="star-map-svg"
      viewBox={viewBoxStr}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Star trade network map"
    >
      {showLanes &&
        map.lanes.map((lane) => (
          <line
            key={`${lane.systemAId}-${lane.systemBId}`}
            x1={lane.x1}
            y1={lane.y1}
            x2={lane.x2}
            y2={lane.y2}
            className="star-map-lane"
            stroke="var(--text-dim)"
            strokeOpacity={lane.opacity}
            strokeWidth={lane.strokeWidth}
          />
        ))}

      {showNpcConvoys &&
        map.npcConvoys.map((convoy, i) => (
          <line
            key={`npc-${convoy.tick}-${convoy.fromSystemId}-${convoy.toSystemId}-${i}`}
            x1={convoy.fromX}
            y1={convoy.fromY}
            x2={convoy.toX}
            y2={convoy.toY}
            className="star-map-npc-convoy"
            stroke={NPC_CONVOY_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeOpacity={0.55}
          />
        ))}

      {showTransportArcs &&
        map.transportArcs.map((arc) => {
          const pos = transportArcPosition(arc)
          return (
            <g key={arc.jobId} className="star-map-transport-arc">
              <line
                x1={arc.originX}
                y1={arc.originY}
                x2={arc.destinationX}
                y2={arc.destinationY}
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.75}
              />
              <circle cx={pos.x} cy={pos.y} r={4} fill="var(--accent)" />
              <title>
                {arc.itemName} ×{arc.quantity}
              </title>
            </g>
          )
        })}

      {map.systems.map((system) => {
        const selected = selectedSystemId === system.id
        const showLabel = shouldShowLabel(system, {
          selectedSystemId,
          hoveredSystemId,
          showAllLabels
        })

        return (
          <g
            key={system.id}
            data-testid={`star-map-node-${system.id}`}
            className={`star-map-node${selected ? ' star-map-node--selected' : ''}`}
            onMouseEnter={() => setHoveredSystemId(system.id)}
            onMouseLeave={() => setHoveredSystemId((id) => (id === system.id ? null : id))}
            onClick={() => onSelectSystem(system.id)}
            style={{ cursor: 'pointer' }}
          >
            {system.eventTicksAgo != null && (
              <circle
                cx={system.x}
                cy={system.y}
                r={NODE_RADIUS + 6}
                fill="none"
                stroke={EVENT_PULSE_COLOR}
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            )}
            {system.isHome && (
              <circle
                cx={system.x}
                cy={system.y}
                r={NODE_RADIUS + 4}
                fill="none"
                stroke={HOME_RING_COLOR}
                strokeWidth={2}
              />
            )}
            <circle
              cx={system.x}
              cy={system.y}
              r={NODE_RADIUS + 2}
              fill="none"
              stroke={ECONOMY_HEAT_COLORS[system.economyHeat]}
              strokeWidth={selected ? 3 : 2}
            />
            <circle cx={system.x} cy={system.y} r={NODE_RADIUS} fill={system.factionColor} />
            {system.contractHighlight && (
              <circle
                cx={system.x + NODE_RADIUS}
                cy={system.y - NODE_RADIUS}
                r={3}
                fill={CONTRACT_HIGHLIGHT_COLOR}
              >
                <title>{system.contractHighlight}</title>
              </circle>
            )}
            {showLabel && (
              <text
                x={system.x}
                y={system.y + LABEL_OFFSET_Y}
                textAnchor="middle"
                className="star-map-label"
              >
                {system.name}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
