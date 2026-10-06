---
layout: post
date: 2026-10-07 00:00:00 -0600
title: ELEUSINIAN SWARMS
author: np
tags:
  - AI
categories:
  - AI
usemathjax: false
---

```
          >   >
     >  >   >   >  >
  >   >   >   >   >   >
     >   >  >   >  >
          >   >
```

Some months ago, I worked on [multi-agent systems](https://nphard.io/2026/02/23/hanabi.html) as part of the RL Residency at Prime Intellect. A lot has happened since then:

- Prime Intellect  [added native support for multi-agent systems in the verifiers library](https://www.primeintellect.ai/blog/multi-agent-systems)
- Agent “swarms” became a much bigger topic of discussion after the [Hugging Face incident](https://openai.com/index/hugging-face-incident-and-the-road-ahead/).
- OpenAI announced a [solution to the Navier–Stokes Millennium Prize Problem](https://openai.com/index/navier-stokes-solution/), reporting that they used ~10K concurrent agents in the effort.
- Some labs have explicitly mentioned multi-agent capabilities in their recent model cards, like [DeepSeek V4.1](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf), [Opus 5.5](https://www-cdn.anthropic.com/fc1b44717c85dc068bc6ba5024219938094694bd/Claude%20Opus%205.5%20System%20Card.pdf), and [Sonnet 5.5](https://www-cdn.anthropic.com/870c8f525702625d2c62fc6dd04c857e3250bec1/Claude%20Sonnet%205.5%20System%20Card.pdf).

Over the past few weeks, inspired by these events, I've been following up on my previous work with a smaller, concrete question: when does letting agents exchange information help them solve a problem, beyond the benefit of running more attempts?[^1].

---

## What we know

There were three sources of useful information for this project:

- published papers on the topic
- recent model cards published by labs
- what people are saying about this!

I'm going to go through some of what have been, in my opinion, the most relevant recent pieces.

### Work

Two of the most interesting papers I've seen recently regarding this topic have been [Scaling Discovery through Test-Time Communication](https://arxiv.org/html/2609.21032v1) and [Self-Organizing Agent Teams Learn to Reason Together](https://arxiv.org/html/2609.22682v1).

The former compares communicating teams with independent attempts, a general approach that I replicate in my experiments. It finds gains on ARC-AGI-3, polyomino packing, and model compression. They report benefits of communication due to the agents being able to share intermediate discoveries, including failures.

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/sdttc_plot.png" alt="Communicating teams compared with independent attempts in Scaling Discovery through Test-Time Communication" width="600">
</div>

Importantly, they also report that the gains are conditional on budgets. The proposed explanation is that cooperation simply works better when the agents have enough time to use each other's findings and can independently verify them.

The latter takes a different approach where teams learn reusable coordination strategies from previous problems, and then apply them to unseen ones. For example, on the mathematics and physics evaluations, the teams outperform both an individual baseline and an oracle selecting among a group of independent solvers.

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/soat_plot.png" alt="Learned agent teams compared with single-agent and routing-oracle baselines" width="600">
</div>

### Model cards

The labs have been reporting similar things in recent model cards, like DeepSeek V4.1 Flash, Opus 5.5 and Sonnet 5.5.

DeepSeek’s report describes persistent teammates, peer messaging, and a shared task board. Its preliminary evaluations show stronger multi-agent performance than single-agent performance at the tested deadlines on ProgramBench and FrontierSWE v2. These are comparisons with single agents, however, rather than a clean measurement of communication’s advantage over independent parallel attempts. [DeepSeek V4.1, §5.3.5](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf).

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/dsv41_plot.png" alt="DeepSeek V4.1 single-agent and multi-agent performance by deadline" width="600">
</div>

On the other hand, Anthropic’s Opus report makes the latency–cost tradeoff particularly clear. On ProgramBench, a five-agent team reaches a mean hidden-test score of 0.6 with a roughly 2.7× speedup in derived latency[^2] over a single agent, while using more tokens. On shorter research tasks, coordination can actually slow the team down unless time pressure encourages useful parallel work. [Opus 5.5, §8.12](https://www-cdn.anthropic.com/fc1b44717c85dc068bc6ba5024219938094694bd/Claude%20Opus%205.5%20System%20Card.pdf).

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/opus55_plot.png" alt="Opus 5.5 ProgramBench performance by derived latency" width="600">
</div>

The Sonnet report shows a similar pattern on ProgramBench: asynchronous subagents with a one-hour budget outperform the single-agent configuration with a four-hour budget, at higher token expenditure. [Sonnet 5.5, §8.12](https://www-cdn.anthropic.com/870c8f525702625d2c62fc6dd04c857e3250bec1/Claude%20Sonnet%205.5%20System%20Card.pdf).

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/sonnet55_plot.png" alt="Sonnet 5.5 ProgramBench score versus derived latency" width="600">
</div>

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/sonnet55_plot2.png" alt="Sonnet 5.5 ProgramBench score versus total tokens" width="600">
</div>

### People

Lastly, another source of information has been, as per usual, to just read speculation going round X:


<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/teor_tweet.png" alt="Teortaxes and Florian Brand speculate about multi-agent training and the roles of different models" width="400">
</div>

And fun experiments, like pomterree's comparison of communicating and independent Minecraft builders:

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/pomterre.png" alt="Pomterre reports a Minecraft building experiment comparing a communicating team with independent agents" width="400">
</div>


There are also some more thought-provoking writings, such as Florian's [Looking into the Swarm's Eye](https://florianbrand.com/posts/swarms), which argues that wall-clock time is becoming a practical limit for single agents, and that swarms offer another way to spend inference compute by letting several agents explore and share what they find, which is in agreement with what's been referenced here already.

And lastly, something to definitely pay attention to are Noam Brown's interviews [with The Information](https://www.youtube.com/watch?v=fqcy0xQATq0&t=1550s) and  [with Dwarkesh](https://www.dwarkesh.com/p/noam-brown). Noam throughout makes special emphasis on latency gains, which, again, is in-tune with the previous mentions. He says that the benefit depends on the task, that coordination introduces overhead, and he describes a deliberately simple interface in which agents send messages that enter one another's context, rather than pushing inductive biases on how to organize.

However, he also gives two reasons to be cautious: first, that productive coordination is difficult to learn because agents can settle into solving independently; second, wrt the Navier–Stokes result he credits the underlying model much more than the multi-agent setup.
## Environment

### Insights

Taken together, these sources suggest looking for tasks where agents can make useful discoveries independently, share them before the task ends, and check whether a teammate's suggestion is any good.

In that direction, I wanted an environment with three properties:

- Something feasible both for a single agent and a team.
- Parallelizable, so teams can actually divide the work, at least in theory.
- Composable, in the sense of partial progress by one agent being useful for other agents too.

I also wanted the communication protocol to stay simple, with agents being able to send information, without assigning a lead agent, or for that matter any specialist roles or mandatory discussion rounds. That way, whether they exploit useful ways of coordinating becomes part of the measurement.

Crucially, I included a baseline of independent solvers, like in the previous work, so that comparing teams to such baseline could tell us what the communication actually contributes.
### Eleusis

I already had a single-agent environment that seemed to fit: Eleusis, which tests long-horizon inductive reasoning and efficient experimentation.

[Eleusis](https://www.pagat.com/eights/eleusis.html) is a card game invented by [Robert Abbott](https://en.wikipedia.org/wiki/Robert_Abbott_(game_designer)) and popularized by [Martin Gardner](https://en.wikipedia.org/wiki/Martin_Gardner). In short, one player acts as the dealer and devises a secret rule that determines which cards can be played. The other players take turns placing cards from their hands onto a sequence, and the dealer tells them whether each play is valid. Accepted cards extend the sequence, while rejected plays provide evidence about what the rule does not allow. The objective is to get rid of your cards, which naturally becomes easier as you figure out the rule.

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/eleusis-hidden-rule.png" alt="" width="400">
</div>

For example, say the accepted sequence is 4♥ → 7♣ → 2♦. Both the colors and the suits alternate, so either could explain what we’ve seen. Playing 9♥ would distinguish these possibilities: it changes suit, but not color. If the dealer rejects it, we can discard the hypothesis that changing suits is enough. A 9♠, on the other hand, would be accepted under either hypothesis, so that result would not help us distinguish them. These are alternative tests from the same position, and choosing between them is part of the game. This is also why Eleusis has been [used to teach scientific reasoning](https://digitalcommons.usu.edu/envs_facpub/20/): players infer possible rules from observations, then choose experiments to test their explanations.

My adaptation was inspired by [David Louapre](https://huggingface.co/dlouapre)’s work at Hugging Face, [Can LLMs Play the Game of Science?](https://huggingface.co/spaces/huggingface/eleusis-benchmark). He adapts Eleusis into a single-player benchmark where models choose card experiments, formulate hypotheses, and decide when they are confident enough to commit to a guess. There's some bits that carry over from his implementation: the hand is replenished after each play, accepted and rejected cards provide evidence, and hypotheses are evaluated by comparing their behavior with the hidden rule. His work was an important inspiration for this environment[^3].

I kept rule discovery as the explicit objective. The agent starts with a hand of cards and an initial card on the table. At each turn, it chooses a card to play and receives feedback on whether the hidden rule accepts or rejects it. An accepted card extends the sequence, while a rejected one is marked alongside it. In either case, the played card is replaced by a draw while cards remain, so emptying the hand is no longer the goal. These observations are the evidence the agent uses to infer the rule.

Separately, the agent submits its current hypothesis on each turn as a Python expression over the proposed card and the accepted sequence. A checker runs this hypothesis against the hidden rule across a broader set of card sequences, as well as the observations collected so far. Agreeing with the cards played during the rollout is therefore not enough to pass. The agent is told whether its hypothesis passes, and the episode ends on a successful check or when a limit is reached. Success here means passing this finite set of checks, rather than proving equivalence for every possible sequence.

Now, to extend this to the multi-agent setting each agent gets its own game, starting from the same deal, and a tool to broadcast messages to the other players. This means, obviously, that games can diverge as players choose different cards to try out. Example: imagine two agents starting with 4♥. The first plays 7♣ and gets an accepted result. This could suggest that ranks must increase, or that colors must alternate. Meanwhile, the second agent tries 9♦ after 4♥ and gets a rejection:

<div style="text-align: center;">
  <img src="https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/eleusis-sharing-experiment.png" alt="" width="400">
</div>

By sharing that observation, the second agent lets the first rule out increasing ranks without spending a turn on that experiment itself. 

This is useful now because by sharing this, the second agent is basically telling the first to rule out a hypothesis "for free" (i.e. without running another experiment). Alternating colors remains a possibility.  The message has to carry context, though, because "9♦ was rejected" does not convey all the info needed; that is, rules can depend on earlier cards or position in the sequence, so the context of an observation matters when communicating it. Thus, teams can more efficiently explore the hypotehsis space, provided they communicate well, of course. 

The communication mechanism is deliberately boring: send_message(message) broadcasts text to all teammates, and queued messages enter each recipient’s context before its next model call. No shared board, assigned roles or required discussion rounds. Agents can compare hypotheses, share counterexamples, or divide up experiments, etc. The team succeeds as soon as any member submits a hypothesis that passes the checker, at which point the other agents are stopped.

You can find the environment on the [Prime Intellect Hub](https://app.primeintellect.ai/dashboard/environments/nph4rd/eleusis), and the code in the public [residency-environments repository](https://github.com/PrimeIntellect-ai/residency-environments/tree/main/environments/eleusis).

## Experiments

The main experiment used 30 fresh rules and three trials per rule in each setting[^4]:

- **Solo:** one solver.
- **Independent:** three solvers, no communication.
- **Cooperative:** three solvers with broadcast messaging

I ran DeepSeek V4.1 Flash, GPT-6 Luna and GPT-6 Sol, for **810 selected episodes**. Each rule had one fixed deal shared across all models, settings and trials so repetitions vary the model's trajectory and not its starting hand.

Each seat had a limit of 100 valid plays. Teams shared a 20-minute gameplay deadline, starting once all seats were ready. Reasoning effort was set to high. Independent teams also stopped at the first verified solution.

### Solve rate

The first result is that cooperation improved on the independent baseline for all three models[^5]. DeepSeek went from 23/90 solves alone to 35/90 independently and 44/90 cooperatively; Luna went from 24 to 36 to 44, and Sol from 53 to 65 to 74. So running three independent attempts already helped quite a bit, and letting the agents communicate added another 8–9 solves per 90 episodes.

![Success rates and cooperative gains over independent teams]({{ site.baseurl }}/images/eleusinian-swarms/eleusis-coverage-and-lift-20260930.png)

In percentage points, independent attempts add roughly 13% over solo, and cooperation adds another 9–10% over independence. This was the first encouraging find because it agreed with the previous work.

Of course, there is still quite a bit of uncertainty. The 95% intervals for the cooperative gain, in percentage points, are −1.1% to +22.2% for DeepSeek, 0.0% to +17.8% for Luna, and +3.3% to +17.8% for Sol. Sol solves more overall and has the clearest positive interval, but its gain from cooperation is about the same as the others'. Direct comparisons do not establish a larger solve-rate benefit for Sol. These are exploratory intervals, without adjustment for multiple comparisons.

Something to note here is that success rate counts episodes in which any team member solves, which is different from an individual agent's pass@1 or the number of distinct rules solved.

The traces give some examples of what the agents were doing. The excerpts below come from three Sol episodes. Bold emphasis is added to help follow the exchanges.

In one run, an agent reported that `3H` after `2S` was accepted at board length six. Another had seen the same transition rejected at length four:

<figure id="trace-context" class="trace-message trace-agent-2">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A2</span><span class="trace-name">Agent 2</span><span class="trace-time">106.17s</span></figcaption>
  <blockquote class="trace-bubble"><p>CRITICAL: my KS-&gt;JS-&gt;9S-&gt;9C-&gt;3D-&gt;2S-&gt;3H <strong>ACCEPTED</strong>, while Agent1 KS-&gt;9D-&gt;5C-&gt;2S-&gt;3H rejected! Thus history-dependent: <strong>same exact prior 2S and candidate 3H different outcome</strong>. […] Need investigate accepted-position periodic/groups or summary.</p></blockquote>
</figure>

<figure class="trace-message trace-agent-1">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A1</span><span class="trace-name">Agent 1</span><span class="trace-time">112.66s</span></figcaption>
  <blockquote class="trace-bubble"><p>Agent2's 2S-&gt;3H <strong>ACCEPTED at len(mainline)=6</strong> whereas my 2S-&gt;3H <strong>REJECTED at len=4</strong>: periodic group reset very plausible! […] Everyone submit next play this expression. If fails test len%k or group of rank ordering.</p></blockquote>
</figure>

The first periodic hypothesis failed, but the agents continued exploring the idea:

<figure class="trace-message trace-agent-3">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A3</span><span class="trace-name">Agent 3</span><span class="trace-time">138.57s</span></figcaption>
  <blockquote class="trace-bubble"><p>Hypothesis len(mainline)%3==0 or card.rank&lt;=prev <strong>INCORRECT</strong> via equivalence checker. […] Testing position 7 (<strong>len%6==0</strong>) as only rank-increase allowed.</p></blockquote>
</figure>

Agent 1 eventually passed the checker with `len(mainline) % 6 == 0 or card.rank <= mainline[-1].rank`: ranks could increase at each six-card reset, and otherwise had to be nonincreasing. The cooperative team finished in 180 seconds, compared with 278 independently. Other agents were still entertaining incorrect alternatives when the episode ended, but the exchange clearly shows how sharing the context of an observation can suggest a new direction.

In another run, agents compared their accepted histories and used five consecutive black cards to discard a proposed maximum-four-black-run rule:

<figure id="trace-counterexample" class="trace-message trace-agent-2">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A2</span><span class="trace-name">Agent 2</span><span class="trace-time">524.70s</span></figcaption>
  <blockquote class="trace-bubble"><p><strong>Counterexample max FOUR consecutive blacks</strong>: mine after7D accepted <strong>FIVE consecutive black</strong> 3S QC 8C QS 7S, and after7H accepted FIVE consecutive 7C9C5S KS QS.</p></blockquote>
</figure>

The eventual solver then proposed a rolling eight-card color-count rule and reported checking it against all three histories:

<figure class="trace-message trace-agent-2">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A2</span><span class="trace-name">Agent 2</span><span class="trace-time">591.16s</span></figcaption>
  <blockquote class="trace-bubble"><p>SOLVED likely: after at least 8 accepted cards, look at <strong>LAST EIGHT accepted colors</strong>; if &gt;=5 BLACK, candidate must RED; otherwise candidate must BLACK (tie 4/4 breaks BLACK). When len&lt;8, any card appears accepted! <strong>Verified EVERY rejection/acceptance of all 3 entire histories</strong> […]</p></blockquote>
</figure>

<figure class="trace-message trace-agent-1">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A1</span><span class="trace-name">Agent 1</span><span class="trace-time">597.67s</span></figcaption>
  <blockquote class="trace-bubble"><p>Agent2 BRILLIANT rolling last8 rule <strong>matches all my results</strong>, including all late red rejections!</p></blockquote>
</figure>

Agent 2 passed the checker at 599 seconds. The independent team did not solve that episode. Here, the messages show both a counterexample to a teammate's hypothesis and explicit uptake of the eventual solution.

Of course, talking did not always lead somewhere useful. In this run, the team settled on alternating rank bands:

<figure id="trace-dead-end" class="trace-message trace-agent-2">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A2</span><span class="trace-name">Agent 2</span><span class="trace-time">73.98s</span></figcaption>
  <blockquote class="trace-bubble"><p>Agent1 7C-&gt;8D was REJECTED, so rank-band rule threshold likely &gt;=9 high vs &lt;=8 low. I'll submit <strong>alternating rank bands &gt;=9 vs &lt;=8</strong> […]</p></blockquote>
</figure>

<figure class="trace-message trace-agent-2">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A2</span><span class="trace-name">Agent 2</span><span class="trace-time">81.81s</span></figcaption>
  <blockquote class="trace-bubble"><p>AC-&gt;9S ACCEPTED, but hypothesis alternate rank bands &gt;=9 vs &lt;=8 <strong>incorrect globally</strong>; global checker says plausible threshold/condition differs elsewhere.</p></blockquote>
</figure>

They kept the strict alternation framing and searched for exceptions. Near the deadline, the discussion had shifted to special conditions for an empty board:

<figure class="trace-message trace-agent-2">
  <figcaption class="trace-speaker"><span class="trace-avatar" aria-hidden="true">A2</span><span class="trace-name">Agent 2</span><span class="trace-time">1171.64s</span></figcaption>
  <blockquote class="trace-bubble"><p>Only untested plausible <strong>empty mainline constraints</strong>: first card NONFACE, NUMBER (2..10), NONACE, PRIME rank, EVEN AND BLACK, even AND club. […] I'll spam nonface/nonace/number empty variants; teammates try prime/even+black if interested.</p></blockquote>
</figure>

The team sent 160 broadcasts and timed out, while the independent agents solved in 239 seconds. The actual rule had overlapping bands: after a rank ≥9, ranks ≤10 were allowed; otherwise ranks ≥9 were allowed. Strict alternation missed the overlap at 9–10.

### Latency

The speed results were less uniform. Sol evidently benefitted much more from the cooperative setup here.  Luna is similar, but with a less noticeable gap between modes. On the other hand, DSV4.1-Flash actually was better in the independent solvers setup during the early gameplay, until eventually the cooperative setup catches up.

![Fraction of episodes solved over gameplay time](https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/eleusis-time-curves-20260930.png)

To include failures, I assigned unsolved episodes the full 20 minutes and averaged over all 90 episodes per setting:

| Model | Independent capped minutes | Cooperative capped minutes | Minutes saved by cooperation, with 95% interval |
|---|---:|---:|---:|
| DeepSeek V4.1 Flash | 15.36 | 15.47 | −0.11 [−0.95, +0.75] |
| GPT-6 Luna | 15.80 | 14.89 | +0.90 [−0.10, +1.91] |
| GPT-6 Sol | 9.28 | 7.35 | +1.93 [+0.74, +3.19] |

Sol saves about two minutes on this measure. DeepSeek's extra solves do not translate into a clear timing gain. This fits the task and capability dependence that [Noam Brown discusses](https://www.dwarkesh.com/p/noam-brown), and specifically DS-V4.1's later improvement also resembles the initial coordination cost discussed in [Scaling Discovery](https://arxiv.org/html/2609.21032v1).

### Team size

As a follow-up, I varied the number of agents: 1, 2, 4, 8 and 16 (with gpt-6 Sol only). This was a separate panel of ten rules with two paired deals each, giving 20 episodes per size and 100 selected episodes overall.

![Success rate across five team sizes](https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/eleusis-team-size-success-scaling-20261001.png)

| Agents | Solved | Mean minutes on the same 14 jointly solved tasks | Estimated cost per episode |
|---|---:|---:|---:|
| 1 | 14/20 · 70% | 3.88 | $0.425 |
| 2 | 18/20 · 90% | 3.26 | $0.490 |
| 4 | 19/20 · 95% | 2.90 | $0.690 |
| 8 | 20/20 · 100% | 2.53 | $0.810 |
| 16 | 20/20 · 100% | 1.89 | $1.195 |


At the 8-agent size, I found the tasks were saturated but more agents at least meant faster solutions, though at a greater cost.

![Success over gameplay time by team size](https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/eleusis-team-size-time-curves-20261001.png)

On the same 14 tasks solved at every size, sixteen agents took about half as long as solo, a 2.05× observed speedup. Compared with eight agents, mean time was approximately 25% lower. Including all 20 tasks and assigning failures 20 minutes gives means of 8.71, 6.26, 4.83, 2.73 and 1.94 minutes for the five sizes.

![Observed latency across team sizes](https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/eleusis-team-size-latency-scaling-20261001.png)

Comparing cost and latency on those same 14 tasks makes the tradeoff easier to see. Two agents were slightly cheaper than solo on average ($0.18 vs $0.21), while finishing sooner. Larger teams continued to reduce latency, but at increasing cost.

![Estimated cost versus time to solution on the same 14 tasks solved at every team size]({{ site.baseurl }}/images/eleusinian-swarms/eleusis-team-size-cost-latency-20261001.png)

Across all 20 tasks, including unsuccessful episodes, sixteen agents cost about 48% more per episode than eight, with the same observed success rate. Two agents had the lowest estimated cost per solve on this panel, at $0.544, compared with $0.607 for solo and $1.195 for sixteen. Thus, optimal team-size depends on how much one values finishing sooner rather than later.

![Estimated inference cost across team sizes](https://raw.githubusercontent.com/nph4rd/nph4rd.github.io/master/images/eleusinian-swarms/eleusis-team-size-cost-scaling-20261001.png)


## Conclusion

I guess more than a conclusion here I end up with a useful environment to confirm results that seem to be becoming the norm in multi-agent systems; namely, that multi-agent cooperative systems contribute to higher solve-rates and decreased latency, conditioned on task-type and model capability. But more than ending words I would like to go straight to some ideas about further work:

- To a certain extent I did not answer the question I started with: it is not clear to me yet where the border lies between environments where this phenomenon is present and where it's not. Meaning: this is now more evident for parallelizable tasks, but I wonder if the benefits of communcation/cooperation can reach other classes of envs in ways that have not been hereafter been measured.
- Eleusis is a very simple environment and, thus, it isolates a lot of the more complex machinery of other more real-world-relevant tasks but it precisely drops - because of that - a lot of the coordination surface that a coding or math env could have with a proper harness. I think attempting to aim to replicate something like this on those environments could give us a lot of information.
- A simplified communication channel minimizes the inductive bias over the cooperation structures that might arise, but perhaps purposeful design of different multi-agent protocols could unlock other features worth studying beyond latency gains, like model-behaviour traits. Hallerite's [On the Nature of the Swarm](https://hallerite.com/posts/on-the-nature-of-the-swarm) discusses this from the perspective of context: persistent agents can retain different parts of what the system has learned and make them available to one another. Shared tools, specialization, and structures that agents can themselves change are interesting directions to explore in richer environments.

---


[^1]: Naturally, the scope of this current work is, therefore, narrower than the previous one. Here, we do not care much about heterogeneous roles, rewards, or adversarial setups like self-play. Instead, we pay more attention to communication and cooperation of homogeneous agents.

[^2]: Both Anthropic reports use **derived latency**, based on reference model speeds and measured tool time, rather than simply reporting elapsed wall-clock time

[^3]: There are a few differences between implementations. In Louapre’s benchmark, hypotheses are expressed in natural language and translated into Python by an auxiliary model before being tested. Models also report their confidence and choose whether to make a formal guess, with a scoring system that penalizes incorrect guesses. In our environment, the agent submits an executable Python hypothesis alongside each card play, without a separate confidence report or decision to commit.

[^4]: The rule dataset was generated in calibration with respect to GLM-5.2, during the development of the single-agent environment. However, a useful feature of this game is that the rules can be made arbitrarily complex, and so it is possible to procedurally adjust the dataset with respect to any model's capability level.

[^5]: Error bars are 95% paired bootstrap intervals over the 30 rules, retaining all three trials and all conditions together. The repetitions are not 90 independent rule types.
