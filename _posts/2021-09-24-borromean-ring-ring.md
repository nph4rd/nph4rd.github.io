---
layout: post
title: "Borromean Rings Ring"
author: Arturo Márquez Flores
tags: [Other, Silversmith]
categories: [Other]
usemathjax: true
---

---
```
    +-----+
    |     |
+-----+   |
|   | |   |
| +-|---+ |
| | | | | |
| | +-|---+
| |   | |
+-|---+ |
  |     |
  +-----+
```
---

**Description**: Gaby ([@gabyjidom](https://www.instagram.com/gabyjidom/)) and I have started going to a silversmithing course with a family friend, Marco, who has been kind enough to show us the basic principles and techniques behind creating silver jewlery. We've now reached that point at which we're supposed to be planning and executing our own projects, and, for a while now, I've been wanting to build a ring with the form of a [Borromean ring](https://en.wikipedia.org/wiki/Borromean_rings). It turns out that doing this actually has a fair degree of mathematical sophistication, and, since I've not found any good on-line resources on how to do this, I'd like to document some of the reasoning behind it.


### Borromean Rings

According to their [Wikipedia entry](), the Borromean rings are _"the Borromean rings are three simple closed curves in three-dimensional space that are topologically linked and cannot be separated from each other, but that break apart into two unknotted and unlinked loops when any one of the three is cut or removed"_.

Apart from their natural mathematical relevance, they are culturally important: they are _"named after the Italian House of Borromeo, who used the circular form of these rings as a coat of arms, but designs based on the Borromean rings have been used in many cultures, including by the Norsemen and in Japan. They have been used in Christian symbolism as a sign of the Trinity, and in modern commerce as the logo of Ballantine beer, giving them the alternative name Ballantine rings."_

They are also relevant to other fields of study: for instance, _"physical instances of the Borromean rings have been made from linked DNA or other molecules, and they have analogues in the Efimov state and Borromean nuclei, both of which have three components bound to each other although no two of them are bound"_.

To understand how it is possible that the Borromean rings are unknotted when one of the rings is removed [^1], I like to think of them as a violation to a sort of transitivity; that is, if we have rings A, B and C. We can "make" them "Borromean" if we think of A being "within" B and B "within" C, **but** C "within" A. Clearly, here we're violating the transitivity of whatever "within" means. This can be perhaps be shown more clearly in the following photo of the first prototype I could build of them:

![photo1](https://raw.githubusercontent.com/arturomf94/arturomf94.github.io/master/images/borromean_rings/photo1.jpeg)

One can notice that such relation with much more clarity:

```
A  ──────────┐
▲            ▼
│            B
│            │
└──── C ◄────┘
```

### Borromean Rings Ring

To be able to construct a ring (as in jewlery 💍) out of some Borromean rings, it is important not only to break transitivity, but also to note that the following conditions cannot be satisfied simultaneously:A

a) The rings are of the same size.

b) The rings are perfectly circular.

The reason they cannot be satisfied simultaneously is because if the rings are perfectly circular *and* of the same size they would not fit "within" each other [^2]. In other words, circular Borromean rings are actually an example of an [impossible object](https://en.wikipedia.org/wiki/Impossible_object). Therefore, if we want the rings to be of the same size (which we do), we'll have to shape them as ellipses, with an arbitrarily small [eccentricity](https://en.wikipedia.org/wiki/Eccentricity_(mathematics)).

This means that, in order to fit a "Borromean rings ring" to a given ring size [^3], we'll have to calculate the circumference of the ellipses that will compose it, which will be, of course, strictly greater than the usual circumference for that given ring size.

### Calculating the ellipses

To understand how we're going to calculate the ellipses, imagine that we have a finger represented by a cylinder, given by the following equation:

$$ \frac{x^2}{r^2} + \frac{y^2}{r^2} = 1 $$

Such cylinder looks a bit like this:

![cylinder](https://raw.githubusercontent.com/arturomf94/arturomf94.github.io/master/images/borromean_rings/cylinder.png)

Note that, given the shape of the Borromean rings, the way way the finger goes through them is a bit like this:

![photo2](https://raw.githubusercontent.com/arturomf94/arturomf94.github.io/master/images/borromean_rings/photo2.jpeg)

That is, each ring is positioned at an angle within the range of $$[\frac{\pi}{8}, \frac{\pi}{4}]$$ ([22.5°, 45°]) _quoad_ the axis that is perpendicular to the finger.

To translate this into maths, what we need to imagine is a hyperplane given by something like the following:

$$ \alpha z = y $$

Where $$\alpha \neq 0$$. This can be seen graphically (with $$\alpha = 2$$) here:

![plane](https://raw.githubusercontent.com/arturomf94/arturomf94.github.io/master/images/borromean_rings/plane.png)

If we picture both the cylinder and the plane, we can start to imagine how their intersection would form an ellipse:

![intersection](https://raw.githubusercontent.com/arturomf94/arturomf94.github.io/master/images/borromean_rings/intersection.png)

However, it is important to see that if we substitute $$y$$ in the equation for the cylinder with $$\alpha z$$ we would get something like the following:

$$ \frac{x^2}{r^2} + \alpha^2\frac{z^2}{r^2} = 1 $$

This is actually an elliptic cylinder! It would look like the following:

![intersection_solution](https://raw.githubusercontent.com/arturomf94/arturomf94.github.io/master/images/borromean_rings/intersection_solution.png)

But we should note that the elipse formed on the $$x-z$$ plane is nothing more than **the projection of the ellipse we're actually looking for onto the x-z plane**. In fact, in the special case of $$\alpha = 1$$, we would get a circle, which, as we will see shortly, is actually the projection of the following ellipse onto the $$x-z$$ plane:

$$ \frac{x^2}{r^2} + \frac{z^2}{2r^2} = 1 $$


To solve our problem it would be easier to parametrise both our cylinder and our plane as follows [^4]:

$$ x = r\cos(\theta) $$

$$ y = r\sin(\theta) $$

$$ z = y\tan(\alpha) $$

This is already our wanted ellipse, it just doesn't look like it still. What we need to do is rotate the whole space around the $$x$$ axis with an angle of $$-\alpha$$. The [rotation](https://en.wikipedia.org/wiki/Rotation_matrix#Basic_rotations) would look as follows:

\begin{aligned}
\begin{bmatrix} \cos\theta \\ \sin\theta \\ \sin\theta\tan\alpha \end{bmatrix}
& \mapsto
\begin{bmatrix}
  \cos\theta \\
  \sin\theta\cos\alpha + \sin\theta\tan\alpha\sin\alpha \\
  -\sin\theta\sin\alpha + \sin\theta\tan\alpha\cos\alpha
\end{bmatrix} \\
& = 
\begin{bmatrix}
  \cos\theta \\
  \sin\theta\cos\alpha + \sin\theta\sin^2\alpha/\cos\alpha \\
  -\sin\theta\sin\alpha + \sin\theta\sin\alpha
\end{bmatrix} \\
& = 
\begin{bmatrix}
  \cos\theta \\
  \sin\theta/\cos\alpha \\
  0
\end{bmatrix}.
\end{aligned}



---

[^1]: Knots that satisfy this property are commonly known as [Brunnian rings](https://en.wikipedia.org/wiki/Brunnian_link).
[^2]: See [this](https://en.wikipedia.org/wiki/Borromean_rings#Ring_shape) for a more detailed explanation of why this is so.
[^3]: I've found [this](https://www.bikerringshop.com/pages/ring-size-chart) conversion table to be particularly useful for this task.
[^4]: This Math Stack Exchange [entry](https://math.stackexchange.com/questions/2618675/prove-that-the-intersection-of-a-cylinder-and-a-plane-forms-an-ellipse) was extremely useful in order to get the solution.
