; 68000 integer greedy palette builder. Each slot is 16 bytes:
; RGB12 ID, count, R/G/B sums, signed fixed-point Oklab L/a/b.
; Counts include two black pseudo-pixels in each of slots 0 and 32.
; Slot 32 is locked, as in the JavaScript converter.

ID      equ 0
COUNT   equ 2
SUMR    equ 4
SUMG    equ 6
SUMB    equ 8
LABL    equ 10
LABA    equ 12
LABB    equ 14

; a0 -> sprite RGB12; a1 -> packed mask; a2 -> destination top-left.
composite_sprite:
        moveq   #31,d7
.row:
        move.l  (a1)+,d6
        moveq   #31,d5
.pixel:
        move.w  (a0)+,d0
        add.l   d6,d6
        bcc.s   .skip
        move.w  d0,(a2)
.skip:
        addq.l  #2,a2
        dbf     d5,.pixel
        adda.w  #(320-32)*2,a2
        dbf     d7,.row
        rts

; Copy the 32 background rows to scratch, then composite at arbitrary ball_x.
prepare_source:
        moveq   #0,d0
        move.w  ball_y,d0
        mulu.w  #640,d0
        lea     source_rgb,a0
        adda.l  d0,a0
        lea     work_image,a1
        move.w  #5119,d7
.copy:
        move.l  (a0)+,(a1)+
        dbf     d7,.copy
        lea     sprite_rgb,a0
        move.w  ball_x,d0
        add.w   ball_y,d0
        btst    #0,d0
        beq.s   .even
        lea     sprite_rgb_odd,a0
.even:
        lea     sprite_mask,a1
        lea     work_image,a2
        move.w  ball_x,d0
        add.w   d0,d0
        adda.w  d0,a2
        bra     composite_sprite

; Restore the previous sprite footprint of this back buffer from the immutable
; preconverted background. Other rows in this buffer are already correct.
restore_back_rows:
        move.w  back_old_y,d0
        bmi.s   .done
        mulu.w  #160,d0
        lea     background_screen,a0
        adda.l  d0,a0
        move.l  back_screen,a1
        adda.l  d0,a1
        move.w  #1279,d7
.screen:
        move.l  (a0)+,(a1)+
        dbf     d7,.screen
        move.w  back_old_y,d0
        subq.w  #1,d0
        mulu.w  #96,d0
        lea     background_palettes,a0
        adda.l  d0,a0
        move.l  back_palettes,a1
        adda.l  d0,a1
        move.w  #767,d7
.palette:
        move.l  (a0)+,(a1)+
        dbf     d7,.palette
.done:
        rts

; Rebuild the 32 rows touched by the new sprite into private back buffers.
rebuild_sprite_rows:
        move.w  ball_y,current_y
        lea     work_image,a0
        move.l  a0,line_source
        move.w  ball_x,d0
        andi.w  #$ffe0,d0
        move.w  d0,start_x
.row:
        bsr     build_line
        bsr     remap_line
        bsr     write_line_palette
        addi.l  #640,line_source
        addq.w  #1,current_y
        move.w  ball_y,d0
        addi.w  #32,d0
        cmp.w   current_y,d0
        bne     .row
        rts

init_active:
        lea     slots,a0
        lea     active,a1
        moveq   #15,d0
.loop:
        move.l  a0,(a1)+
        lea     16(a0),a0
        dbf     d0,.loop
        lea     switch_events,a0
        move.l  a0,next_event
        move.w  #$ffff,dirty_pairs
        clr.w   current_x
        rts

; Palette-register reload boundaries, precomputed from spectrum512-slots.js.
update_active:
        move.l  next_event,a0
        move.w  current_x,d0
        cmp.w   (a0),d0
        bne.s   .done
        move.w  2(a0),d0           ; logical register number
        move.w  d0,d1
        lsl.w   #2,d1
        lea     active,a1
        addi.l  #16*16,0(a1,d1.w) ; advance this register to its next physical slot
        move.w  dirty_pairs,d1
        bset    d0,d1
        move.w  d1,dirty_pairs
        addq.l  #4,a0
        move.l  a0,next_event
.done:
        rts

build_line:
        move.w  current_y,d0
        mulu.w  #7680,d0
        lea     background_checkpoints,a0
        adda.l  d0,a0
        move.w  start_x,d0
        lsr.w   #5,d0
        mulu.w  #768,d0
        adda.l  d0,a0
        lea     slots,a1
        move.w  #191,d0
.checkpoint:
        move.l  (a0)+,(a1)+
        dbf     d0,.checkpoint
        bsr     init_active
.seek:
        move.l  next_event,a0
        move.w  (a0),d0
        cmp.w   start_x,d0
        bhi.s   .ready
        move.w  d0,current_x
        bsr     update_active
        bra.s   .seek
.ready:
        move.w  start_x,current_x
        move.l  line_source,a6
        move.w  start_x,d0
        add.w   d0,d0
        adda.w  d0,a6
.pixel:
        bsr     update_active
        move.w  (a6)+,d0
        lea     incoming,a0
        bsr     make_pixel
        lea     active,a5
        moveq   #0,d5
.find:
        move.l  (a5)+,a0
        move.w  incoming+ID,d0
        cmp.w   ID(a0),d0
        beq.s   .match
        tst.w   COUNT(a0)
        beq.s   .empty
        addq.w  #1,d5
        cmpi.w  #16,d5
        bne.s   .find
        movem.l a6,-(sp)
        bsr     find_merge
        bsr     apply_merge
        movem.l (sp)+,a6
        bra.s   .next
.match:
        addq.w  #1,COUNT(a0)
        move.w  incoming+SUMR,d0
        add.w   d0,SUMR(a0)
        move.w  incoming+SUMG,d0
        add.w   d0,SUMG(a0)
        move.w  incoming+SUMB,d0
        add.w   d0,SUMB(a0)
        bra.s   .dirty
.empty:
        move.l  a0,a1
        lea     incoming,a0
        bsr     copy_slot
.dirty:
        move.w  dirty_pairs,d0
        bset    d5,d0
        move.w  d0,dirty_pairs
.next:
        addq.w  #1,current_x
        cmpi.w  #320,current_x
        bne     .pixel
        rts

; RGB12 in d0, destination a0. Clobbers d0-d2/a1.
make_pixel:
        move.w  d0,ID(a0)
        move.w  #1,COUNT(a0)
        move.w  d0,d1
        lsr.w   #8,d1
        move.w  d1,SUMR(a0)
        move.w  d0,d1
        lsr.w   #4,d1
        andi.w  #15,d1
        move.w  d1,SUMG(a0)
        move.w  d0,d1
        andi.w  #15,d1
        move.w  d1,SUMB(a0)
load_lab:
        move.w  ID(a0),d0
        move.w  d0,d1
        add.w   d0,d0
        lsl.w   #2,d1
        add.w   d1,d0             ; six bytes per RGB12 coordinate record
        lea     oklab_table,a1
        adda.w  d0,a1
        move.l  (a1)+,LABL(a0)
        move.w  (a1),LABB(a0)
        rts

copy_slot:
        move.l  (a0)+,(a1)+
        move.l  (a0)+,(a1)+
        move.l  (a0)+,(a1)+
        move.l  (a0)+,(a1)+
        rts

; a0/a1 slots -> unsigned 16-bit squared distance in d0 (upper word zero).
; d1-d3/a2 scratch; sum fits 16 bits for the generated coordinate table.
color_distance:
        lea     square_table+254,a2
        move.w  LABL(a0),d1
        sub.w   LABL(a1),d1
        add.w   d1,d1
        moveq   #0,d0
        move.w  0(a2,d1.w),d0
        move.w  LABA(a0),d1
        sub.w   LABA(a1),d1
        add.w   d1,d1
        add.w   0(a2,d1.w),d0
        move.w  LABB(a0),d1
        sub.w   LABB(a1),d1
        add.w   d1,d1
        add.w   0(a2,d1.w),d0
        rts

merge_cost:
        bsr     color_distance
        move.w  COUNT(a0),d1
        lsl.w   #2,d1
        lea     weight_rows,a2
        move.l  0(a2,d1.w),d2
        lea     weight_table,a2
        adda.l  d2,a2
        move.w  COUNT(a1),d1
        add.w   d1,d1
        mulu.w  0(a2,d1.w),d0
        rts

; Incoming pairs first, then existing pairs in logical-index order. Stable ties.
find_merge:
        move.l  #$7fffffff,best_cost
        lea     incoming,a0
        lea     active,a5
        moveq   #0,d5
.incoming:
        move.l  (a5)+,a1
        cmpa.l  #slots+32*16,a1
        beq.s   .incoming_next
        bsr     merge_cost
        cmp.l   best_cost,d0
        bcc.s   .incoming_next
        move.l  d0,best_cost
        move.w  #-1,best_a
        move.w  d5,best_b
.incoming_next:
        addq.w  #1,d5
        cmpi.w  #16,d5
        bne.s   .incoming

        move.w  dirty_pairs,d7
        moveq   #0,d5
.outer:
        move.w  d5,d0
        lsl.w   #2,d0
        lea     active,a5
        move.l  0(a5,d0.w),a0
        move.w  d5,d6
        addq.w  #1,d6
        cmpa.l  #slots+32*16,a0
        beq.s   .outer_next
.inner:
        move.w  d6,d0
        lsl.w   #2,d0
        move.l  0(a5,d0.w),a1
        cmpa.l  #slots+32*16,a1
        beq.s   .inner_next
        move.w  d5,d0
        lsl.w   #4,d0
        add.w   d6,d0
        lsl.w   #2,d0
        lea     pair_costs,a4
        adda.w  d0,a4
        btst    d5,d7
        bne.s   .refresh
        btst    d6,d7
        beq.s   .cached
.refresh:
        bsr     merge_cost
        move.l  d0,(a4)
.cached:
        move.l  (a4),d0
        cmp.l   best_cost,d0
        bcc.s   .inner_next
        move.l  d0,best_cost
        move.w  d5,best_a
        move.w  d6,best_b
.inner_next:
        addq.w  #1,d6
        cmpi.w  #16,d6
        bne.s   .inner
.outer_next:
        addq.w  #1,d5
        cmpi.w  #15,d5
        bne     .outer
        clr.w   dirty_pairs
        rts

apply_merge:
        lea     active,a5
        move.w  best_b,d5
        move.w  d5,d0
        lsl.w   #2,d0
        move.l  0(a5,d0.w),a0
        moveq   #0,d7
        bset    d5,d7
        move.w  best_a,d6
        bmi.s   .incoming
        bset    d6,d7
        move.w  d6,d0
        lsl.w   #2,d0
        move.l  0(a5,d0.w),a1
        cmpa.l  a1,a0
        bcs.s   .ordered
        exg     a0,a1
.ordered:
        move.l  a1,-(sp)
        bsr     merge_slots
        move.l  (sp)+,a1
        lea     incoming,a0
        bsr     copy_slot
        bra.s   .done
.incoming:
        lea     incoming,a1
        bsr     merge_slots
.done:
        move.w  d7,dirty_pairs
        rts

; Merge into a0. Accumulate precise nibble sums, round only representative.
merge_slots:
        move.w  COUNT(a1),d0
        add.w   d0,COUNT(a0)
        move.w  SUMR(a1),d0
        add.w   d0,SUMR(a0)
        move.w  SUMG(a1),d0
        add.w   d0,SUMG(a0)
        move.w  SUMB(a1),d0
        add.w   d0,SUMB(a0)
        move.w  COUNT(a0),d2
        move.w  d2,d3
        lsr.w   #1,d3
        moveq   #0,d0
        move.w  SUMR(a0),d0
        add.w   d3,d0
        divu.w  d2,d0
        lsl.w   #8,d0
        move.w  d0,d4
        moveq   #0,d0
        move.w  SUMG(a0),d0
        add.w   d3,d0
        divu.w  d2,d0
        lsl.w   #4,d0
        or.w    d0,d4
        moveq   #0,d0
        move.w  SUMB(a0),d0
        add.w   d3,d0
        divu.w  d2,d0
        or.w    d0,d4
        move.w  d4,ID(a0)
        bra     load_lab

remap_line:
        bsr     init_active
        moveq   #0,d0
        move.w  current_y,d0
        mulu.w  #160,d0
        move.l  back_screen,a6
        adda.l  d0,a6
        move.l  a6,a0
        moveq   #39,d0
.clear:
        clr.l   (a0)+
        dbf     d0,.clear
        move.l  line_source,remap_source
        move.w  #$8000,pixel_bit
.pixel:
        bsr     update_active
        move.l  remap_source,a0
        move.w  (a0)+,d0
        move.l  a0,remap_source
        lea     incoming,a0
        bsr     make_pixel
        lea     active,a5
        move.w  #$ffff,d6
        moveq   #0,d5
        moveq   #0,d7
.nearest:
        move.l  (a5)+,a1
        bsr     color_distance
        cmp.w   d6,d0
        bcc.s   .candidate_next
        move.w  d0,d6
        move.w  d5,d7
        tst.w   d0
        beq.s   .encode
.candidate_next:
        addq.w  #1,d5
        cmpi.w  #16,d5
        bne.s   .nearest
.encode:
        move.w  pixel_bit,d0
        btst    #0,d7
        beq.s   .p1
        or.w    d0,(a6)
.p1:
        btst    #1,d7
        beq.s   .p2
        or.w    d0,2(a6)
.p2:
        btst    #2,d7
        beq.s   .p3
        or.w    d0,4(a6)
.p3:
        btst    #3,d7
        beq.s   .next
        or.w    d0,6(a6)
.next:
        lsr.w   #1,d0
        bne.s   .same_group
        move.w  #$8000,d0
        addq.l  #8,a6
.same_group:
        move.w  d0,pixel_bit
        addq.w  #1,current_x
        cmpi.w  #320,current_x
        bne     .pixel
        rts

write_line_palette:
        moveq   #0,d0
        move.w  current_y,d0
        subq.w  #1,d0
        mulu.w  #96,d0
        move.l  back_palettes,a1
        adda.l  d0,a1
        lea     slots,a0
        lea     ste_colors,a2
        moveq   #47,d7
.loop:
        move.w  ID(a0),d0
        add.w   d0,d0
        move.w  0(a2,d0.w),(a1)+
        lea     16(a0),a0
        dbf     d7,.loop
        rts
