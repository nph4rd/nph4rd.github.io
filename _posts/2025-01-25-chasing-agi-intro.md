---
layout: post
title: "CHASING AGI"
author: np
tags: [AI]
categories: [AI]
usemathjax: true
---


```
└[∵┌]
```

## Motivation

Keeping up with AI progress is hard. There is a fair amount of noise and there's **also** a lot of signal [^1]. It's especially hard to follow when you don't take notes of what's happening, or a clear idea of **where progress comes from**. I think jumping between abstraction layers could be a good way to build intuition around the dynamics of this _industrialization of intelligence_. So I want to dedicate a series of posts that will indeed jump between more low-level technicalities and and higher-order ideas to improve my own and other people's understanding of what is actually happening [^2]. This will probably be at times a rough scratchpad and some other times a more formal note-taking excercise. I don't really have a very clear idea of how it will turn out, but I will at least try to nail down a desiderata for the series:

1. The info will not be completely self-contained (or else I will never finish), but I will try to add references whenever possible.
2. There should be a format indicating ideas that are speculative. I'll think about this when the time comes. I will definitely try to be very clear whenever I'm adding my personal perspective.
3. The notes should follow empricial work more than theory. This will probably help with point 2.
4. There should be a rough categorization strategy that serves as a guideline for the series.

## Categorization

I will try to use the following categories during the series and tag each post with a theme. Hopefully this will make it easier to navigate the series, in case anyone wants to skip to any specific bit.

- Background
    - The promise of AGI
    - NN essentials
    - The previous paradigm
    - The transformer architecture
    - Scaling hypothesis
    - Evals
- Text
    - Pre-training
    - Post-training
    - Inference
- Image
    - Vision
    - Diffusion
- Reasoning
    - RL
- Agents
    - Tools
    - Memory
- Other
    - Embeddings
    - Quantization
    - Evaluation

I think the list above might have some chronological sense, but I would not want to commit to a specific order, so I'll consider it to be an unordered list. Also, FWIW: I think I'll leave this base entry as a draft while I work on the rest. That way I can come back to refine the categorization :)

🍀

---
[^1]: DeepSeek is an excellent example of a source of great information about the state of the art. It's been really inspiring to see them pierce through the hype with their open-source philosophy.

[^2]: There are many other similar efforts like this, but I took inspiration from logs like [TDM's Keeping up with AGI](https://docs.google.com/document/u/0/d/e/2PACX-1vQD8IlBotGdBxp3BnXkSjk8bNZlPV_0EH9ZA6wHd5dNf-BLSiwXUinvgv8ZoBEnNyTCF-chWO30NRw0/pub?pli=1). There were others, but I forget now. Anyway, I will probably find them again and share them in the series.