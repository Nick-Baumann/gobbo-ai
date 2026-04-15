# LLM Coach

Self-play is data-efficient at the start and slow at the end. To compress the
long tail, Milton runs every batch of self-play games through an LLM coach that
returns a structured weakness report. Subsequent self-play oversamples
positions matching the reported fingerprints.

Default provider is xAI Grok. The interface is a simple trait, swapping
providers is a matter of implementing one method.
