import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Seeding synthetic demonstration intelligence into OSINTiger...');

  const targetId = 'demo-investigation-apex-defense';
  const targetDomain = 'apex-cyber-defense.example';

  const existing = await prisma.investigation.findUnique({ where: { id: targetId } }).catch(() => null);
  if (!existing) {
    const demoReport = {
      bluf: "Apex Cyber Defense (Synthetic Profile) operates as a simulated tier-1 managed security service provider. Analysis of public infrastructure reveals authoritative DNS delegation via Cloudflare, valid TLS certificates issued by Let's Encrypt, and zero presence on OFAC or international sanctions rosters.",
      five_w_one_h: {
        who: "Apex Cyber Defense Inc. (Synthetic Entity #SYN-94821)",
        what: "Commercial security monitoring, threat intelligence reporting, and managed SOC services",
        when: "First observed active in public DNS registries on 2021-04-12; updated 2026-03-01",
        where: "Delaware incorporation (simulated), primary infrastructure hosted across US-East AWS endpoints",
        why: "Enterprise cyber threat intelligence and defensive posture assessments",
        how: "Multi-tenant cloud architecture with distributed scanning endpoints and API gateways"
      },
      key_findings: [
        {
          claim: "Primary domain resolves to Cloudflare Anycast IP addresses 104.21.48.112 and 172.67.182.45 [SOURCE: DNS-over-HTTPS, URL: https://cloudflare-dns.com/dns-query]",
          confidence: 0.98,
          source: "dns_google",
          category: "infrastructure"
        },
        {
          claim: "TLS certificate SAN includes *.apex-cyber-defense.example and api.apex-cyber-defense.example issued by Let's Encrypt Authority X3 [SOURCE: crt.sh, URL: https://crt.sh/?q=apex-cyber-defense.example]",
          confidence: 0.95,
          source: "crtsh",
          category: "cryptographic"
        },
        {
          claim: "Entity screening against OFAC SDN and European consolidated sanctions rosters returned zero adverse matches [SOURCE: OFAC SDN Database, URL: https://sanctionssearch.ofac.treas.gov]",
          confidence: 0.99,
          source: "ofac",
          category: "compliance"
        },
        {
          claim: "Corporate filings demonstrate good standing under Delaware Division of Corporations file number SYN-782194 [SOURCE: OpenCorporates, URL: https://opencorporates.com/companies/us_de/SYN-782194]",
          confidence: 0.92,
          source: "opencorporates",
          category: "corporate"
        }
      ],
      detailed_analysis: "Synthetic investigation executed across 18 public telemetry sources. Domain infrastructure shows hardened TLS 1.3 configuration, strict HSTS headers, and multi-region anycast edge distribution. Cross-source corroboration validates that all corporate and technical indicators align with legitimate commercial defensive operations.",
      attribution_valid: true,
      needs_manual_review: false,
      confidence_score: 96,
      hypotheses: [
        { id: "H1", statement: "Entity is a legitimate, compliant managed security service provider", probability: 0.94 },
        { id: "H2", statement: "Entity infrastructure is compromised or acting as a proxy", probability: 0.06 }
      ]
    };

    await prisma.investigation.create({
      data: {
        id: targetId,
        target: targetDomain,
        inputType: 'domain',
        language: 'en',
        script: 'Latn',
        status: 'completed',
        currentStep: 8,
        totalSteps: 8,
        modules: JSON.stringify(['dns', 'tls', 'corporate', 'sanctions', 'threat_intel']),
        sourceResults: JSON.stringify([
          { source: 'dns_google', status: 'completed', recordsCount: 6 },
          { source: 'crtsh', status: 'completed', recordsCount: 4 },
          { source: 'ofac', status: 'completed', recordsCount: 0 },
          { source: 'opencorporates', status: 'completed', recordsCount: 1 }
        ]),
        reportJson: JSON.stringify(demoReport),
        cacheExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        starred: true,
        tags: JSON.stringify(['synthetic-demo', 'infrastructure', 'clean-profile'])
      }
    });
  }

  // 2. Synthetic Knowledge Base Entity
  const entityId = 'kb-entity-apex-demo';
  const existingEntity = await prisma.kBEntity.findUnique({ where: { id: entityId } }).catch(() => null);
  if (!existingEntity) {
    await prisma.kBEntity.create({
      data: {
        id: entityId,
        primaryName: targetDomain,
        normalizedName: targetDomain.toLowerCase(),
        type: 'domain',
        aliasesJson: JSON.stringify(['api.apex-cyber-defense.example', 'portal.apex-cyber-defense.example']),
        attributesJson: JSON.stringify({ registrar: 'MarkMonitor Inc.', status: 'clientTransferProhibited' }),
        confidence: 0.98,
        tier: 3,
        status: 'verified'
      }
    });
  }

  // 3. Synthetic Provenance Event
  const rawPayload = JSON.stringify({ domain: targetDomain, status: 'verified', timestamp: new Date().toISOString() });
  const payloadHash = createHash('sha256').update(rawPayload).digest('hex');

  await prisma.provenanceEvent.create({
    data: {
      id: randomUUID(),
      investigationId: targetId,
      evidenceId: 'ev-' + randomUUID().slice(0, 8),
      eventType: 'collection',
      eventTime: new Date(),
      collectorName: 'dns_telemetry',
      collectionMethod: 'api_client',
      executionContext: JSON.stringify({ environment: 'production', mode: 'synthetic_demo' }),
      collectorVersion: '1.0.0',
      toolName: 'dns_google',
      toolVersion: '1.0.0',
      toolConfig: JSON.stringify({ endpoint: 'https://dns.google/resolve' }),
      toolMode: 'sync',
      toolLimitations: 'Public resolver rate limits apply',
      collectedAt: new Date(),
      ingestedAt: new Date(),
      queryString: targetDomain,
      queryParams: JSON.stringify({ type: 'A' }),
      investigationContext: 'Synthetic Baseline Verification',
      queryNormalized: targetDomain.toLowerCase(),
      sourceUrl: 'https://dns.google/resolve',
      sourceUrls: JSON.stringify(['https://dns.google/resolve']),
      sourceType: 'primary',
      canonicalization: 'RFC 1035 canonical domain name',
      rawPayload: rawPayload,
      rawHash: payloadHash,
      rawSize: rawPayload.length,
      normalizedData: rawPayload,
      confidence: 0.98,
      actorId: 'system-bootstrap',
      actorType: 'system',
      integrityHash: payloadHash,
      pipelineStage: 'collection',
      processingStatus: 'verified'
    }
  });

  console.log('[seed] Synthetic demo intelligence successfully seeded.');
}

main()
  .catch((e) => {
    console.error('[seed] Error seeding demo data:', e);
  })
  .finally(() => prisma.$disconnect());
