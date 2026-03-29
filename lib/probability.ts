export type RelationshipType = 'positive' | 'negative' | 'neutral'

export interface Market {
  id: string
  source: 'kalshi' | 'polymarket'
  external_id: string
  title: string
  probability: number
  category: string
  last_updated: string
}

export interface MarketRelationship {
  id: string
  market_a_id: string
  market_b_id: string
  relationship_type: RelationshipType
  weight: number // 0–1
  notes?: string
}

export interface ScenarioResult {
  market: Market
  current_probability: number
  implied_probability: number
  distortion: number // positive = underpriced, negative = overpriced
  direction: 'up' | 'down' | 'neutral'
  relationship_type: RelationshipType
  weight: number
  notes?: string
  analysis: string // human-readable explanation
}

/**
 * Given an assumed event and its related markets, compute implied probability shifts.
 *
 * When resolves_yes = false (market resolves NO), relationship directions are flipped:
 *   positive → negative, negative → positive
 *
 * Formula:
 *   positive relationship: implied = P(B) + weight * (1 - P(B))
 *   negative relationship: implied = P(B) - weight * P(B)
 *   distortion = implied - current (positive = market is underpriced given assumption)
 */
export function computeScenario(
  assumedProbability: number,
  relatedMarkets: Array<{ market: Market; relationship: MarketRelationship }>,
  resolvesYes = true
): ScenarioResult[] {
  return relatedMarkets
    .map(({ market, relationship }) => {
      const p = market.probability
      const w = relationship.weight * assumedProbability

      // Flip direction when modelling a NO resolution
      let effectiveType = relationship.relationship_type
      if (!resolvesYes && effectiveType !== 'neutral') {
        effectiveType = effectiveType === 'positive' ? 'negative' : 'positive'
      }

      let implied: number
      if (effectiveType === 'positive') {
        implied = p + w * (1 - p)
      } else if (effectiveType === 'negative') {
        implied = p - w * p
      } else {
        implied = p
      }

      implied = Math.min(1, Math.max(0, implied))
      const distortion = implied - p
      const direction = distortion > 0.01 ? 'up' : distortion < -0.01 ? 'down' : 'neutral'

      const analysis = buildAnalysis(market, relationship, direction, resolvesYes, w)

      return {
        market,
        current_probability: p,
        implied_probability: implied,
        distortion,
        direction,
        relationship_type: relationship.relationship_type,
        weight: relationship.weight,
        notes: relationship.notes,
        analysis,
      } as ScenarioResult
    })
    .sort((a, b) => Math.abs(b.distortion) - Math.abs(a.distortion))
}

function buildAnalysis(
  market: Market,
  rel: MarketRelationship,
  direction: 'up' | 'down' | 'neutral',
  resolvesYes: boolean,
  scaledWeight: number
): string {
  const confidence = rel.weight >= 0.7 ? 'strong' : rel.weight >= 0.45 ? 'moderate' : 'weak'
  const outcome = resolvesYes ? 'resolves YES' : 'resolves NO'
  const moveWord = direction === 'up' ? 'should rise' : direction === 'down' ? 'should fall' : 'is unlikely to move'
  const confidencePhrase = confidence === 'strong' ? 'High-confidence signal' : confidence === 'moderate' ? 'Moderate signal' : 'Weak signal'

  if (rel.notes) {
    return `${rel.notes} — ${confidencePhrase} (weight ${(rel.weight * 100).toFixed(0)}%).`
  }

  // Fallback generic explanation
  const relDesc = rel.relationship_type === 'positive'
    ? 'positively correlated with'
    : rel.relationship_type === 'negative'
    ? 'negatively correlated with'
    : 'weakly linked to'

  return `This market is ${relDesc} the assumed event. If the event ${outcome}, this market ${moveWord}. ${confidencePhrase} (weight ${(rel.weight * 100).toFixed(0)}%).`
}

export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

export function formatDistortion(d: number): string {
  const sign = d > 0 ? '+' : ''
  return `${sign}${(d * 100).toFixed(1)}pp`
}
