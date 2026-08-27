---
title: Calculating Geometric Offsets Based on Target Area in GIS
date: 2026-02-21 12:54:00
tags:
  - GIS
  - Python
  - Geometry
  - Algorithm
categories:
  - GIS Development
mathjax: true
---

## Introduction

Assume that all coordinates are expressed in a suitable projected Cartesian coordinate system, so Euclidean lengths and planar areas are meaningful. Land subdivision sometimes involves moving a line segment between two non-parallel boundaries to produce a polygon with a specified area.

**The Scenario:**
A user initiates a tool and defines:

1. **Line 1:** A fixed vertex **A** and a direction point **B**.
2. **Line 2:** A fixed vertex **C** and a direction point **D**.
3. **Target Area:** The required area of the generated trapezoid, expressed in the square units of the projected coordinate system.

**The Goal:**
Calculate the offset distance **$h$** and the coordinates of the new segment **$A'C'$** such that the area of the polygon **$AA'C'C$** equals the **Target Area**.

<!-- more -->

---

## The Geometric Concept: The "Virtual Triangle"

Because lines $AB$ and $CD$ are not parallel, their infinite extensions intersect at a unique point. Let us call this intersection point **$O$**.

1. **The Base Triangle:** The segments $OA$ and $OC$ form a triangle $\triangle OAC$ (the "Virtual Triangle").
2. **The Scaled Triangle:** Moving $AC$ to $A'C'$ creates another triangle, $\triangle OA'C'$, which may be larger or smaller than $\triangle OAC$.
3. **Similarity:** Multiplying both vectors from $O$ by the same scale factor makes $A'C'$ parallel to $AC$. Therefore, $\triangle OA'C'$ is **similar** to $\triangle OAC$.

The area of the desired trapezoid ($AA'C'C$) is the absolute difference between the areas of the two triangles.

$$ \text{Area}_{\text{trapezoid}} = \left|\text{Area}(\triangle OA'C') - \text{Area}(\triangle OAC)\right| $$

### The Scaling Law
For similar triangles, the ratio of their areas is equal to the square of the ratio of their corresponding dimensions (side lengths or heights).

If we let $S_0$ be the area of $\triangle OAC$ and $S_{\text{new}}$ be the area of $\triangle OA'C'$, the non-negative scaling factor $k$ is:

$$ k = \sqrt{\frac{S_{\text{new}}}{S_0}} $$

Once $k$ is found, the new coordinates $A'$ and $C'$ can be found by simply scaling the vectors starting from the intersection point $O$.

---

## The Derivation

To solve this programmatically, we need to derive the formula for the offset distance $h$.

Let:

* $S_0$ be the area of the virtual triangle $\triangle OAC$.
* $L$ be the length of segment $AC$.
* $H$ be the altitude of $\triangle OAC$ from $O$ to base $AC$.
* $T$ be the user-specified target area.

From triangle geometry, we know:
$$ H = \frac{2 S_0}{L} $$

For an outward subdivision, $S_{\text{new}}=S_0+T$ and the new height is $H+h$. The scaling law gives

$$ \frac{H + h}{H} = \sqrt{\frac{S_0 + T}{S_0}}. $$

Solving for $h$:
$$ h = H \left( \sqrt{1 + \frac{T}{S_0}} - 1 \right). $$

Substituting $H$:
$$ h = \frac{2 S_0}{L} \left( \sqrt{1 + \frac{T}{S_0}} - 1 \right). $$

For an inward subdivision, $S_{\text{new}}=S_0-T$ and the new height is $H-h$. Therefore,

$$
h=H\left(1-\sqrt{1-\frac{T}{S_0}}\right)
=\frac{2S_0}{L}\left(1-\sqrt{1-\frac{T}{S_0}}\right),
\qquad 0\leq T\leq S_0.
$$

---

## The Algorithm

To implement this in a GIS tool, such as a QGIS plugin or an ArcPy script, follow this logic:

1. **Find Intersection ($O$):**
    Compute the intersection point of the infinite lines defined by vectors $\vec{AB}$ and $\vec{CD}$. Use a scale-aware tolerance to identify parallel or nearly parallel lines.
    Parallel boundaries require a separate construction and are outside the non-parallel scenario considered here.

2. **Calculate Initial Virtual Area ($S_0$):**
    Calculate the area of the triangle formed by $O, A, C$.

3. **Determine Direction (Add or Subtract Area):**
    We must determine if the user wants to expand the triangle (offset away from $O$) or shrink it (offset toward $O$).
    * Calculate both $\vec{OA}\cdot\vec{AB}$ and $\vec{OC}\cdot\vec{CD}$.
    * Both dot products must have the same sign; otherwise, the two direction points select inconsistent branches from $O$.
    * **If both are positive:** The boundaries point away from $O$, so $S_{\text{new}}=S_0+T$.
    * **If both are negative:** The boundaries point toward $O$, so $S_{\text{new}}=S_0-T$.

4. **Calculate Scale Factor ($k$):**
    $$ k = \sqrt{S_{\text{new}} / S_0} $$

5. **Compute New Coordinates:**
    Scale the vectors from the origin $O$:
    $$ A' = O + (A - O) \cdot k $$
    $$ C' = O + (C - O) \cdot k $$

6. **Compute Height ($h$):**
    Calculate the perpendicular distance from $A'$ to the infinite line through $A$ and $C$.

---

## Python Implementation

Below is a simple Python function that performs this calculation.

```python
import math


def calculate_offset_geometry(
    ptA, ptB, ptC, ptD, target_area, epsilon=1e-8
):
    """
    Calculate offset distance h and new coordinates A', C' from a target area.

    All points must use the same projected Cartesian coordinate system.

    Args:
        ptA, ptB: (x, y) tuples defining line 1.
        ptC, ptD: (x, y) tuples defining line 2.
        target_area: Required area of polygon AA'C'C.
        epsilon: Relative tolerance for geometric comparisons.

    Returns:
        A dictionary containing h, A_prime, and C_prime.
    """
    if epsilon <= 0:
        raise ValueError("epsilon must be positive.")
    if not math.isfinite(target_area) or target_area < 0:
        raise ValueError("target_area must be a finite, non-negative number.")

    coordinates = (*ptA, *ptB, *ptC, *ptD)
    if len(coordinates) != 8 or not all(map(math.isfinite, coordinates)):
        raise ValueError("Each point must contain two finite coordinates.")

    def vector(start, end):
        return (end[0] - start[0], end[1] - start[1])

    def dot(u, v):
        return u[0] * v[0] + u[1] * v[1]

    def cross(u, v):
        return u[0] * v[1] - u[1] * v[0]

    def norm(v):
        return math.hypot(v[0], v[1])

    direction_ab = vector(ptA, ptB)
    direction_cd = vector(ptC, ptD)
    base = vector(ptA, ptC)
    length_ab = norm(direction_ab)
    length_cd = norm(direction_cd)
    base_length = norm(base)
    geometry_scale = max(1.0, length_ab, length_cd, base_length)
    length_tolerance = epsilon * geometry_scale

    if length_ab <= length_tolerance or length_cd <= length_tolerance:
        raise ValueError("Each boundary line requires two distinct points.")
    if base_length <= length_tolerance:
        raise ValueError("A and C must be distinct points.")

    denominator = cross(direction_ab, direction_cd)
    if abs(denominator) <= epsilon * length_ab * length_cd:
        raise ValueError("Boundary lines are parallel or nearly parallel.")

    # A + parameter * AB is the intersection O.
    parameter = cross(vector(ptA, ptC), direction_cd) / denominator
    O = (
        ptA[0] + parameter * direction_ab[0],
        ptA[1] + parameter * direction_ab[1],
    )

    vector_oa = vector(O, ptA)
    vector_oc = vector(O, ptC)
    length_oa = norm(vector_oa)
    length_oc = norm(vector_oc)
    twice_initial_area = abs(cross(vector_oa, vector_oc))

    if (
        length_oa <= length_tolerance
        or length_oc <= length_tolerance
        or twice_initial_area <= epsilon * length_oa * length_oc
    ):
        raise ValueError("The virtual triangle is degenerate.")

    direction_a = dot(vector_oa, direction_ab)
    direction_c = dot(vector_oc, direction_cd)
    ambiguous_a = epsilon * length_oa * length_ab
    ambiguous_c = epsilon * length_oc * length_cd

    if abs(direction_a) <= ambiguous_a or abs(direction_c) <= ambiguous_c:
        raise ValueError("A boundary direction is numerically ambiguous.")
    if (direction_a > 0) != (direction_c > 0):
        raise ValueError("AB and CD select inconsistent branches from O.")

    initial_area = twice_initial_area / 2.0
    if direction_a > 0:
        new_area = initial_area + target_area
    else:
        if target_area > initial_area and not math.isclose(
            target_area, initial_area, rel_tol=epsilon
        ):
            raise ValueError(
                "Target area exceeds the size of the converging triangle tip."
            )
        new_area = max(0.0, initial_area - target_area)

    scale = math.sqrt(new_area / initial_area)
    A_prime = (
        O[0] + vector_oa[0] * scale,
        O[1] + vector_oa[1] * scale,
    )
    C_prime = (
        O[0] + vector_oc[0] * scale,
        O[1] + vector_oc[1] * scale,
    )

    displacement = vector(ptA, A_prime)
    h = abs(cross(base, displacement)) / base_length

    return {
        "h": h,
        "A_prime": A_prime,
        "C_prime": C_prime,
    }
```

---

## Another Perspective: Determinants and Vector Projection

The virtual-triangle method can also be described entirely using linear algebra. This perspective treats triangle area as a determinant and the offset distance as the length of a vector component. It provides a compact alternative formulation and another way to verify the geometry. In this section, $\lambda$ is the same scale factor as $k$ above, and $T$ is the same target area.

Translate the coordinate system so that the intersection point $O$ is the origin. Define

$$
\mathbf{a}=A-O,\qquad
\mathbf{c}=C-O,\qquad
M=\begin{bmatrix}\mathbf{a}&\mathbf{c}\end{bmatrix}.
$$

The determinant of $M$ is the signed area of the parallelogram formed by $\mathbf{a}$ and $\mathbf{c}$. Therefore, the area of the virtual triangle is

$$
S_0=\frac{1}{2}\left|\det(M)\right|.
$$

Scale both vectors by the same factor $\lambda$:

$$
\mathbf{a}'=\lambda\mathbf{a},\qquad
\mathbf{c}'=\lambda\mathbf{c}.
$$

The segment joining the scaled endpoints is therefore parallel to $AC$.

If $M'=[\mathbf{a}'\ \mathbf{c}']=\lambda M$, then

$$
\det(M')=\lambda^2\det(M).
$$

For an outward subdivision with target area $T$,

$$
\frac{1}{2}\left(\left|\det(M')\right|-\left|\det(M)\right|\right)=T.
$$

Substituting $\det(M')=\lambda^2\det(M)$ gives

$$
\lambda
=\sqrt{1+\frac{2T}{|\det(M)|}}.
$$

For an inward subdivision, the new triangle is smaller, so

$$
\lambda
=\sqrt{1-\frac{2T}{|\det(M)|}},
\qquad
0\leq T\leq\frac{|\det(M)|}{2}.
$$

Finally, translate the scaled vectors back to the original coordinate system:

$$
A'=O+\lambda(A-O),\qquad
C'=O+\lambda(C-O).
$$

<img src="/images/linear-algebra-parallel-subdivision.svg" alt="Original vectors and their scaled versions forming a parallel subdivision" style="display: block; margin-left: auto; margin-right: auto; width: 75%;" />

### Finding the offset distance by projection

Let the displacement from $A$ to $A'$ be

$$
\Delta\mathbf{a}=A'-A=(\lambda-1)\mathbf{a},
$$

and let the original base direction be

$$
\mathbf{d}=C-A.
$$

The component of $\Delta\mathbf{a}$ parallel to $AC$ is

$$
\operatorname{proj}_{\mathbf{d}}(\Delta\mathbf{a})=
\frac{\Delta\mathbf{a}\cdot\mathbf{d}}
     {\mathbf{d}\cdot\mathbf{d}}\mathbf{d}.
$$

Subtracting this projection leaves the perpendicular component. Its norm is the offset distance:

$$
h=
\left\|
\Delta\mathbf{a}
-\operatorname{proj}_{\mathbf{d}}(\Delta\mathbf{a})
\right\|.
$$

### NumPy implementation

The following function applies this formulation after the intersection point $O$ has been found. Passing `outward=False` selects the inward solution.

```python
import math
import numpy as np


def subdivision_by_linear_algebra(
    ptO, ptA, ptC, target_area, outward=True, epsilon=1e-12
):
    if epsilon <= 0:
        raise ValueError("epsilon must be positive.")
    if not math.isfinite(target_area) or target_area < 0:
        raise ValueError("target_area must be a finite, non-negative number.")

    O = np.asarray(ptO, dtype=float)
    A = np.asarray(ptA, dtype=float)
    C = np.asarray(ptC, dtype=float)

    points = (O, A, C)
    if any(point.shape != (2,) for point in points):
        raise ValueError("Each point must contain exactly two coordinates.")
    if not all(np.all(np.isfinite(point)) for point in points):
        raise ValueError("All coordinates must be finite.")

    a = A - O
    c = C - O
    base = C - A
    length_a = np.linalg.norm(a)
    length_c = np.linalg.norm(c)
    base_length = np.linalg.norm(base)
    geometry_scale = max(1.0, length_a, length_c, base_length)
    length_tolerance = epsilon * geometry_scale
    matrix = np.column_stack((a, c))
    twice_initial_area = abs(np.linalg.det(matrix))

    if (
        length_a <= length_tolerance
        or length_c <= length_tolerance
        or twice_initial_area <= epsilon * length_a * length_c
    ):
        raise ValueError("The virtual triangle is degenerate.")

    sign = 1.0 if outward else -1.0
    scale_squared = 1.0 + sign * 2.0 * target_area / twice_initial_area

    if scale_squared < -epsilon:
        raise ValueError("The inward target area exceeds the virtual triangle.")
    scale = math.sqrt(max(0.0, scale_squared))

    A_prime = O + scale * a
    C_prime = O + scale * c

    displacement = A_prime - A
    base_squared = np.dot(base, base)
    if base_squared <= length_tolerance**2:
        raise ValueError("A and C must be distinct points.")

    parallel_component = np.dot(displacement, base) / base_squared * base
    perpendicular_component = displacement - parallel_component
    h = np.linalg.norm(perpendicular_component)

    scaled_matrix = scale * matrix
    calculated_area = abs(
        abs(np.linalg.det(scaled_matrix)) - twice_initial_area
    ) / 2.0

    return {
        "scale": scale,
        "h": float(h),
        "A_prime": tuple(map(float, A_prime)),
        "C_prime": tuple(map(float, C_prime)),
        "calculated_area": float(calculated_area),
    }
```

For example, take $O=(0,0)$, $A=(8,1)$, $C=(6,3)$, and $T=20$:

```python
result = subdivision_by_linear_algebra(
    ptO=(0, 0),
    ptA=(8, 1),
    ptC=(6, 3),
    target_area=20,
)

print(result)
```

This produces approximately:

```text
{
    'scale': 1.79505494,
    'h': 5.05969863,
    'A_prime': (14.36043949, 1.79505494),
    'C_prime': (10.77032961, 5.38516481),
    'calculated_area': 20.0
}
```

Here, $|\det(M)|=18$ and $|\det(M')|=58$. Their difference is $40$, so the area between the two parallel segments is $(58-18)/2=20$, as required.
