; Timed palette stream from jscolorquantizer/slide.s (delay through trailing
; writes retained instruction-for-instruction). 60 Hz, 8 MHz 68000, STE RGB.
spectrum_vbl:
        tst.w   $43e.w
        bne     raster_return
        movem.l d0-d7/a0-a6,-(sp)
        move.w  sr,-(sp)
        move.w  #$2700,sr
        addq.l  #1,vbl_counter
        move.w  pending_view,d0
        bmi.s   .no_swap
        move.l  back_screen,d1
        move.l  front_screen,back_screen
        move.l  d1,front_screen
        move.l  back_palettes,d2
        move.l  front_palettes,back_palettes
        move.l  d2,front_palettes
        move.l  d2,display_palettes_pointer
        ifd EIGHT_BALLS
        move.l  back_positions,d2
        move.l  front_positions,back_positions
        move.l  d2,front_positions
        else
        move.w  back_old_y,d2
        move.w  front_old_y,back_old_y
        move.w  d2,front_old_y
        endc
        move.b  d1,$ffff820d.w
        lsr.l   #8,d1
        move.b  d1,$ffff8203.w
        lsr.l   #8,d1
        move.b  d1,$ffff8201.w
        move.w  #-1,pending_view
.no_swap:
        lea     $ffff8240.w,a4
        lea     $ffff8209.w,a5
        lea     delay,a6
        move.l  display_palettes_pointer,a3
        lea     (a4),a0
        rept 8
        move.l  (a3)+,(a0)+
        endr
        move.w  #198,d7
        clr.l   d0
.wait:
        tst.b   (a5)
        beq.s   .wait
        move.b  (a5),d0
        add.l   d0,a6
        jmp     (a6)
delay:
	rept 120

	nop

	endr
	
setcolor:
	nop

	lea		(a4),a0
	lea		(a4),a1
	lea		(a4),a2

	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+

	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+

	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+

	dbf		d7,setcolor

	lea		(a4),a0
	lea		(a4),a1
	lea		(a4),a2
	
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+

	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+

	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+
	move.l	(a3)+,(a2)+

	nop
	nop

	lea		(a4),a0
	lea		(a4),a1
	lea		(a4),a2
	
	lea		-19040(a3),a4

	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+
	move.l	(a3)+,(a0)+

	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+
	move.l	(a3)+,(a1)+

	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+
	move.l	(a4)+,(a2)+

	move	(sp)+,sr
        movem.l (sp)+,d0-d7/a0-a6


raster_return:
        rts
