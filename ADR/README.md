# Architectural Decision Records (ADR)

This directory contains all major architectural decisions made during the development of the UIT-GO ride-hailing platform.

## What is an ADR?

An **Architectural Decision Record (ADR)** is a document that captures an important architectural decision along with its context and consequences. ADRs help teams:

- 📝 **Document the "why"** behind technical decisions
- 🔍 **Provide context** for future developers and stakeholders
- ⚖️ **Show trade-offs** considered during decision-making
- 🎯 **Justify technology choices** with data and reasoning
- 📚 **Build institutional knowledge** that survives team changes

## ADR Format

Each ADR follows a standard template:

```markdown
# ADR XXX: [Title]

**Status**: [Accepted/Rejected/Deprecated/Superseded]
**Date**: YYYY-MM-DD
**Deciders**: [Who made the decision]
**Tags**: [relevant, keywords]

## Context and Problem Statement

[What problem are we trying to solve?]

## Decision Drivers

[What factors influenced the decision?]

## Considered Options

[What alternatives did we evaluate?]

## Decision Outcome

[What did we choose and why?]

## Consequences

[What are the results of this decision?]

## References

[Links to relevant documentation]
```

---

## Current ADRs

### [ADR 001: Redis for Geospatial Indexing](./001-redis-geospatial-vs-dynamodb.md)

**Status**: ✅ Accepted  
**Decision**: Use Redis with GEORADIUS commands instead of DynamoDB with custom geohash implementation.

**Key Points**:

- ⚡ Sub-10ms query performance (measured 4.8ms avg)
- 💰 5.3x cheaper than DynamoDB ($110/month vs $580/month)
- 🚀 Native geospatial support, no custom logic needed
- 📊 Load tested with 10,000 drivers successfully

**Trade-offs**:

- ✅ Faster, simpler, cheaper
- ⚠️ In-memory only (mitigated by RDB+AOF persistence)
- ⚠️ Need to manage Redis cluster (vs fully-managed DynamoDB)

---

### [ADR 002: Event-Driven Architecture with Apache Kafka](./002-kafka-event-driven-architecture.md)

**Status**: ✅ Accepted  
**Decision**: Use Apache Kafka for asynchronous event streaming instead of direct HTTP calls or AWS SQS/SNS.

**Key Points**:

- 🔄 **Event sourcing**: Can replay events for debugging, analytics
- 📈 **High throughput**: Handles 1000+ events/sec, tested with 217 events/sec
- 🎯 **Message ordering**: Guaranteed within partition (critical for trip lifecycle)
- 🛡️ **Fault tolerance**: Messages replicated across brokers

**Trade-offs**:

- ✅ Decoupled services, horizontal scaling, event replay
- ⚠️ Operational complexity (managed by AWS MSK in production)
- ⚠️ Eventual consistency (acceptable <100ms delay)

---

### [ADR 003: Database Per Service with MongoDB](./003-database-per-service-mongodb.md)

**Status**: ✅ Accepted  
**Decision**: Each microservice has its own dedicated MongoDB instance instead of a shared database.

**Key Points**:

- 🔓 **Service independence**: Can deploy, scale services independently
- 📊 **Optimized per use case**: Driver Service gets bigger DB, User Service doesn't need it
- 🛡️ **Fault isolation**: One database crash doesn't affect all services
- 🚀 **Technology flexibility**: Could switch to PostgreSQL later if needed

**Trade-offs**:

- ✅ True microservices isolation, independent scaling
- ⚠️ No cross-service JOINs (use API calls or denormalize)
- ⚠️ Eventual consistency (acceptable with event-driven architecture)

---

### [ADR 004: Traefik v3 as API Gateway](./004-traefik-api-gateway.md)

**Status**: ✅ Accepted  
**Decision**: Use Traefik v3 instead of NGINX, Kong, or AWS ALB for API Gateway and load balancing.

**Key Points**:

- 🐳 **Docker-native**: Auto-discovers services via Docker labels
- ⚡ **Zero-downtime**: Update routes without restart
- 📊 **Built-in dashboard**: Real-time traffic visualization
- 🔒 **Let's Encrypt**: Automatic SSL certificates

**Trade-offs**:

- ✅ <5ms proxy overhead, automatic service discovery
- ⚠️ Learning curve (different from NGINX)
- ⚠️ Newer technology (but v3 is stable)

---

### [ADR 005: WebSocket with Socket.IO](./005-websocket-socketio-realtime.md)

**Status**: ✅ Accepted  
**Decision**: Use Socket.IO for real-time bidirectional communication instead of polling, SSE, or native WebSocket.

**Key Points**:

- 🔄 **Automatic fallback**: WebSocket → Long-polling → Polling
- 📡 **Real-time updates**: Driver location every 5 seconds
- 🎯 **Room system**: Easy broadcast to specific users
- 📱 **Mobile support**: Official iOS/Android clients

**Trade-offs**:

- ✅ <100ms message delivery, auto-reconnect, battle-tested
- ⚠️ Heavier than raw WebSocket (50KB client library)
- ⚠️ Need Redis adapter for horizontal scaling

---

## How to Use ADRs

### For Developers

When working on a feature:

1. **Check relevant ADRs** before making architectural changes
2. **Understand the context** of why decisions were made
3. **Follow established patterns** documented in ADRs
4. **Propose new ADRs** for significant changes

### For Reviewers

During code review:

1. **Verify alignment** with ADR decisions
2. **Challenge violations** of established patterns
3. **Suggest ADR updates** if context has changed

### For Stakeholders

When evaluating the system:

1. **Understand trade-offs** made during development
2. **See evidence** of thoughtful decision-making
3. **Review costs** and benefits of technology choices

---

## Decision Process

### When to Create an ADR

Create an ADR when:

- ✅ Choosing between multiple technology options (database, message queue, etc.)
- ✅ Making a decision that affects multiple teams/services
- ✅ Implementing a pattern that should be followed consistently
- ✅ Making a trade-off with long-term consequences
- ✅ Changing an existing architectural decision

**Don't** create an ADR for:

- ❌ Routine implementation details (variable names, code style)
- ❌ Temporary workarounds or experiments
- ❌ Decisions easily reversible without cost

### ADR Lifecycle

```
1. PROPOSED → Team discusses alternatives
2. ACCEPTED → Decision implemented
3. DEPRECATED → Replaced by newer decision
4. SUPERSEDED → Replaced by ADR XXX
```

---

## Template

Copy this template when creating a new ADR:

```markdown
# ADR XXX: [Short Title]

**Status**: Proposed  
**Date**: YYYY-MM-DD  
**Deciders**: Technical Architecture Team  
**Tags**: [tag1, tag2, tag3]

---

## Context and Problem Statement

[Describe the context and the problem we're trying to solve]

---

## Decision Drivers

### Functional Requirements

- [Requirement 1]
- [Requirement 2]

### Non-Functional Requirements

- [Performance, scalability, cost, etc.]

---

## Considered Options

### Option 1: [Name] (Chosen/Rejected)

**Description**: [Brief description]

**Pros**:

- ✅ [Advantage 1]
- ✅ [Advantage 2]

**Cons**:

- ❌ [Disadvantage 1]
- ❌ [Disadvantage 2]

### Option 2: [Name]

[Same structure as Option 1]

---

## Decision Outcome

**Chosen option: [Option X] - [Reason]**

### Rationale

1. [Key reason 1]
2. [Key reason 2]

### Trade-offs Accepted

- [Trade-off 1 and mitigation]
- [Trade-off 2 and mitigation]

---

## Consequences

### Positive

- ✅ [Positive consequence 1]
- ✅ [Positive consequence 2]

### Negative

- ⚠️ [Negative consequence 1 and mitigation]
- ⚠️ [Negative consequence 2 and mitigation]

---

## Follow-up Actions

- [ ] Action 1 (deadline)
- [ ] Action 2 (deadline)

---

## References

- [Link to documentation]
- [Link to benchmark results]

---

**Reviewed by**: [Names]  
**Approved by**: [Name]  
**Next Review**: [Date]
```

---

## Contributing

### Proposing a New ADR

1. **Copy the template** above
2. **Number sequentially** (next available number)
3. **Fill in all sections** with details and data
4. **Get feedback** from team (PR review)
5. **Present to architecture team** if major decision
6. **Update status** once accepted

### Updating an Existing ADR

- **Minor updates** (typos, links): Direct edit
- **Context changes**: Add "Update" section with date
- **Decision changes**: Create new ADR, mark old as "Superseded"

### Deprecating an ADR

```markdown
**Status**: Deprecated  
**Superseded by**: [ADR XXX](./XXX-new-decision.md)  
**Reason**: [Why this decision is no longer valid]
```

---

## Best Practices

### ✅ Do

- **Be specific**: Include metrics, benchmarks, cost estimates
- **Show trade-offs**: List pros AND cons for each option
- **Provide context**: Explain the problem, not just the solution
- **Use data**: Back up claims with measurements
- **Keep updated**: Add follow-up notes as you learn more

### ❌ Don't

- **Be vague**: "Option A is better" (better how? show data!)
- **Hide cons**: Every decision has trade-offs
- **Write novels**: Keep it concise, link to detailed docs
- **Make it personal**: Focus on technical merits, not opinions
- **Forget to update**: Mark as deprecated when superseded

---

## Statistics

| Metric         | Value |
| -------------- | ----- |
| **Total ADRs** | 5     |
| **Accepted**   | 5     |
| **Rejected**   | 0     |
| **Deprecated** | 0     |
| **Superseded** | 0     |

### Decision Timeline

```
2025-10-13: ADR 004 (Traefik)
2025-10-14: ADR 003 (Database Per Service)
2025-10-15: ADR 001 (Redis Geospatial)
2025-10-16: ADR 002 (Kafka Events)
2025-10-17: ADR 005 (WebSocket)
```

---

## Further Reading

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) - Michael Nygard
- [ADR GitHub Organization](https://adr.github.io/)
- [Architecture Decision Records (ADRs)](https://www.thoughtworks.com/en-us/radar/techniques/architectural-decision-records)
- [When to Use ADRs](https://engineering.atspotify.com/2020/04/14/when-should-i-write-an-architecture-decision-record/)

---

**Maintained by**: UIT-GO Architecture Team  
**Last Updated**: October 29, 2025  
**Next Review**: December 2025
