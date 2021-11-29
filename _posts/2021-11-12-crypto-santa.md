---
layout: post
title: "Crypto Santa"
author: Arturo Márquez Flores
tags: [Cryptography]
categories: [Cryptography]
usemathjax: true
---

---
```
  .-""-.._
 /,.._____\
() { _____ }
  ( /-O-O-\ )
  { `--^--' }
  {   `o'   } Encrypt everything!
   {       }
    `-----'
```
---

**Description**:

During Christmas 2019, I implemented [this](https://github.com/arturomf94/secret-santa) simple secret santa program [^1] that was able generate a random permutation of a set of parties and send each party an email indicating the person to whom that party should give a x-mas present 🎄🎁. I actually used that program to play secret santa with my cousins that year! (See the image below 🥰).

![primarquez](https://raw.githubusercontent.com/arturomf94/arturomf94.github.io/master/images/primarquez.jpeg)

Although that program worked very well back then, I realised that the permutation me and my cousins used was **secret to them, but not to me** since I had run the program myself, as a trusted third party (TTP) and I wondered whether there was a protocol that would allow us to do this **without any TTPs!**. Apart from from it being an interesting problem in this context, I also thought it could be thought of as a more general coordination problem that might have applications in other fields 🤔 [^2].

I stopped thinking about that problem soon after, but recently I saw this tweet that grabbed my attention:

<blockquote class="twitter-tweet" data-theme="dark"><p lang="en" dir="ltr">Hey crypto (as in cryptography) folks - is there a way to do a secret Santa (that is, generate a random permutation) such that everyone knows only the person they&#39;re assigned, with nobody knowing the complete mapping?</p>&mdash; nick.eth (@nicksdjohnson) <a href="https://twitter.com/nicksdjohnson/status/1448072476181815299?ref_src=twsrc%5Etfw">October 12, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

To which, of course, I replied:

<blockquote class="twitter-tweet" data-theme="dark"><p lang="en" dir="ltr">omg! I&#39;ve been wondering about this since xmas 2019!</p>&mdash; Arturo MF (@arturomf94) <a href="https://twitter.com/arturomf94/status/1448155071464738822?ref_src=twsrc%5Etfw">October 13, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

There were a bunch of replies by [@LindellYehuda](https://twitter.com/LindellYehuda) that made me think about this again. Specifically, I found this one really interesting:

<blockquote class="twitter-tweet" data-theme="dark"><p lang="en" dir="ltr">With semi honest security, it should be quite easy. I’d generate a shared ElGamal key pair and encrypt each number separately. Then, in turn, each party permutes the ciphertexts and rerandomizes them. Finally, each party gets one ciphertext and distributed decryption is run. &gt;&gt;</p>&mdash; Yehuda Lindell (@LindellYehuda) <a href="https://twitter.com/LindellYehuda/status/1448148173944414214?ref_src=twsrc%5Etfw">October 13, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

It seemed to me that this problem could be solved with a fairly simple protocol and I made the decision to implement it for this (2021) Christmas, at least as POC program that simulates the parties and their interactions, while omitting everything else around the protocol, such as the secure communication channels, the clients, etc. In what follows I will describe the protocol in a little more detail, provide some more information about the actual work behind this (that is, the previous research work by other people who actually designed some protocols to solve this) and share some details about my implementation and how to use it.

### The protocol

Secret Santa is actually a very popular tradition in the West, as pointed out in its [Wikipedia entry](https://en.wikipedia.org/wiki/Secret_Santa). Traditionally (at least in my family) people would get together and write the names of the participants on pieces of paper, that would then be placed in some sort of container (bag, hat, or whatever). The container would then be passed around among the participants, and each would draw one piece of paper. If the paper they drew has their own name on it then, of course, he/she would show it to the rest of the participants, place the paper back into the recipient and draw another one. This step is repeated until that person has a paper that does not have their own name on it, and, thus, a random mapping is created, which is not known to any of the participants. This is beatiful, of course, and it's the trivial solution to what we seek, but we want to be able to replicate something like this for the case where the participants can't meet in person! The following is a description of **one solution** to this problem, but it is possible to do this in a number of different ways.

Before going into details about the  protocol (at least in my own words) I should credit the people who actually worked on this problem, so first things first:

#### The actual work

Although I did not make a very thorough search for previous work (after all, I'm only doing this for fun), I did find three very interesting articles/papers about _crypto santa_ [^3]:

The first one was an [open-access](https://orbilu.uni.lu/handle/10993/25936) paper from 2010 by _Sjouke Mauw, Sasa Radomirovic, and Peter Ryan_, in which the authors offer a _decentralized_ solution using the ElGamal cryptosystem (which will be outlined in the next section). The protocol they describe is similar to the one outlined by Yehuda Lindell in the tweet above, except for the fact that they include a _derangement test_ to assure that the resulting permutation is a derangement (i.e. has no fixed-points), and a _commitment step_ so as to make the protocol verifiable (i.e. to detect cheaters! 🕵️). Presumbly, the idea to have a **shared** ElGamal key-pair is so that it can be used as a [threshold cryptosystem](https://en.wikipedia.org/wiki/Threshold_cryptosystem). Although this is really cool, I think it is unnecessary, as we will see in the following work.

The second paper I found was a subsequent work by _Peter Ryan_, that can be found as a [chapter](https://link.springer.com/chapter/10.1007%2F978-3-662-49301-4_33) to a [book](https://link.springer.com/book/10.1007/978-3-662-49301-4) from 2016 that is unfortunately behind a paywall [^4]. The protocol described here is very elegant and is actually the main basis of my implementation. I will describe it in a little more detail below. For now it suffices to say that one of the main differences is that in this protocol each party has their own key-pair, instead of having a shared key-pair with which all encryptions are done, as in the one outlined in the tweet or in the previous 2010 paper.

The last paper I found was an older (2007), perhaps more general solution to this same problem. [This paper](https://eprint.iacr.org/2007/353.pdf) by _Chris Studholme and Ian Blake_ proposes a protocol that (much like the paper that was just mentioned) depends on each player deriving a key-pair with the ElGamal cryptosystem. The protocol is pretty much the same as the one described in 2016 "Crypto Santa", although some of the details in each of the steps differ. For instance, in the former there is a last step where each of the participants share _one of their two secret keys_ with the rest of the participants, whereas in the latter each participant $$i$$ relays a _shared_ value $$g^{\hat{s}_i}$$, where $$\hat{s}_i$$ is recursively defined as $$\hat{s}_i = \hat{s}_{i-1} \cdot s_i$$. That is, each participant relays the previous shared value raised to a specific re-encryption value determined by the participant in turn.

In order for us to better understand why this can be done, let's have a look at what the ElGamal cryptosystem is.

#### ElGamal

The ElGamal cryptosystem depends on the computational difficulty of solving [discrete logarithms](https://en.wikipedia.org/wiki/Discrete_logarithm) in certain [groups](https://en.wikipedia.org/wiki/Group_(mathematics)), such as the [multiplicative group of integers modulo n](https://en.wikipedia.org/wiki/Multiplicative_group_of_integers_modulo_n), which is [cyclic](https://en.wikipedia.org/wiki/Cyclic_group) if $$n$$ is $$1, 2, 4, p^k, 2p^k$$, where $$ p $$ is an odd prime (see [this](https://en.wikipedia.org/wiki/Multiplicative_group_of_integers_modulo_n#Cyclic_case) for more info). Since cyclic groups have _a generator_, $$ g $$, this means that for any $$ x \in \{1, n-1\} $$ it is unfeasible to compute $$ x $$ from knowledge of only $$ g^x $$, whenever $$n$$ is a _"large enough"_ prime [^5]. From now on, we will assume we use a group, $$ G $$, with the characteristics that we just mentioned, and we will denote with $$ q $$ the _"large enough"_ prime for the group (which is also its _order_).

The _key generation_ process for ElGamal is simple: Once the group $$ G $$ has been established with the characteristics mentioned above, each party can generate a private key by randomly choosing an integer $$ x \in \{1, ... , q - 1\}$$. We can then compute the value: $$ h = g^x$$, which is needed to construct the full public key: $$ (G, q, g, h) $$.

Under this scheme, encryption consists on the following: a party uses the public key, $$ (G, q, g, h) $$, to encrypt a message $$ M $$ by mapping $$ M $$ to an element, $$ m $$, of $$ G $$ and choosing a random element $$ s \in \{1, ... , q - 1\}$$. The value $$ s $$ is then used to compute a _shared secret_: $$ r = h^s $$. With this, the ciphertext (which consists of two values) can be constructed: $$ (c_1, c_2) = (g^s, m \cdot r) $$.

Now, decryption is as follows: the owner of the private key, $$ x $$ corresponding to public key $$ (G, q, g, h) $$ can recover $$ m $$ with the following steps:

1. Compute $$ c_{1}^{x} $$, which is $$ g^xs = h^s = r $$, thus recovering the shared secret. 
2. Compute the inverse of the shared secret, $$ r^{-1} $$ [^6].
3. Compute $$ m = c_{2} \cdot r^{-1}$$.
4. Map $$m$$ back to the plaintext $$M$$.



### The implementation

🍀

---

[^1]: I'd like to point out that this implementation is not entirely my own. I actually recycled a bunch of code I found somewhere, but I can't remember exactly where now. Credits to the commons, though, I guess 🤷.
[^2]: Because [trusted third parties are security loopholes](https://nakamotoinstitute.org/trusted-third-parties/).
[^3]: Mainly thanks to [this](https://crypto.stackexchange.com/a/36854) StackExchange answer.
[^4]: It would be a shame if anyone undermined this effort to keep this knowledge behind a paywall by searching for the [book's URL](https://link.springer.com/book/10.1007/978-3-662-49301-4) in one of those terrible and evil [open-science](https://en.wikipedia.org/wiki/Open_science) platforms such as [Sci-Hub](https://en.wikipedia.org/wiki/Sci-Hub). **DO NOT DO THIS**.
[^5]: Note that if $$ n $$ is a prime then it satisfies the condition that $$ n $$ is either $$ 1, 2, 4, p^k $$ or $$ 2p^k $$. Furthermore, we can [know](https://en.wikipedia.org/wiki/Multiplicative_group_of_integers_modulo_n#Structure) that the [_order_](https://en.wikipedia.org/wiki/Order_(group_theory)) of the group is given by $$ n -1 $$.
[^6]: This can be done in a number of ways. For example, one can use the [extended Euclidean algorithm](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) or use [Lagrange's theorem](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) to compute $$ c^{q-x}_{1} $$ as the inverse.
