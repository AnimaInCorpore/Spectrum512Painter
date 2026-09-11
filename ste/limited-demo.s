; Moving STE ball: 10 background registers + 6 sprite registers per line.
; Build and verify with node tools/verify-limited.mjs. ESC restores the desktop.
        text
start:
        move.l  sp,a5
        lea     stack_top,sp
        move.l  4(a5),a5
        move.l  $c(a5),d0
        add.l   $14(a5),d0
        add.l   $1c(a5),d0
        addi.l  #$100,d0
        move.l  d0,-(sp)
        move.l  a5,-(sp)
        clr.w   -(sp)
        move.w  #$4a,-(sp)
        trap    #1
        lea     12(sp),sp
        move.w  #4,-(sp)
        trap    #14
        addq.l  #2,sp
        move.w  d0,old_resolution
        cmpi.w  #2,d0
        beq     exit_program
        move.w  #2,-(sp)
        trap    #14
        addq.l  #2,sp
        move.l  d0,old_physbase
        move.w  #3,-(sp)
        trap    #14
        addq.l  #2,sp
        move.l  d0,old_logbase
        pea     save_hardware
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        lea     screen_storage,a0
        move.l  a0,d0
        addi.l  #255,d0
        andi.l  #$ffffff00,d0
        move.l  d0,screen_base
        move.l  d0,front_screen
        addi.l  #32000,d0
        move.l  d0,back_screen
        clr.w   -(sp)
        move.l  front_screen,-(sp)
        move.l  front_screen,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        pea     mouse_off
        clr.w   -(sp)
        move.w  #$19,-(sp)
        trap    #14
        addq.l  #8,sp
        lea     limited_screen,a0
        move.l  screen_base,a1
        move.l  back_screen,a2
        move.w  #7999,d7
.copy:
        move.l  (a0)+,d0
        move.l  d0,(a1)+
        move.l  d0,(a2)+
        dbf     d7,.copy
        move.l  #sprite_palette_stream,front_palettes
        move.l  #sprite_palette_stream,back_palettes
        pea     install_display
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
draw_begin:
        bsr     restore_ball
        bsr     draw_ball
        bsr     reuse_background_colors
        bsr     write_ball_palette
draw_done:
        move.w  ball_y,back_old_y
        move.w  ball_x,back_old_x
        move.w  #1,pending_view
.present:
        tst.w   pending_view
        bpl.s   .present
        move.w  back_old_x,d0
        move.w  front_old_x,back_old_x
        move.w  d0,front_old_x
        addq.l  #1,frame_count
display_ready:
.poll:
        move.w  #2,-(sp)
        move.w  #1,-(sp)
        trap    #13
        addq.l  #4,sp
        tst.l   d0
        beq.s   .advance
        move.w  #2,-(sp)
        move.w  #2,-(sp)
        trap    #13
        addq.l  #4,sp
        cmpi.b  #27,d0
        beq.s   quit_demo
        cmpi.b  #32,d0
        bne.s   .advance
        eori.w  #1,paused
.advance:
        tst.w   paused
        bne.s   .poll
        bsr     move_ball
        bra     draw_begin
quit_demo:
        pea     remove_display
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        move.w  old_resolution,-(sp)
        move.l  old_physbase,-(sp)
        move.l  old_logbase,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        pea     restore_hardware
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        pea     mouse_on
        clr.w   -(sp)
        move.w  #$19,-(sp)
        trap    #14
        addq.l  #8,sp
exit_program:
        clr.w   -(sp)
        trap    #1

; All hardware and low-memory accesses run through XBIOS Supexec.
install_display:
        move.w  sr,-(sp)
        move.w  #$2700,sr
        clr.b   $ffff820a.w
        clr.b   $ffff820d.w
        clr.b   $ffff820f.w
        clr.b   $ffff8265.w
        move.l  #sprite_palette_stream,display_palettes_pointer
        move.w  #-1,pending_view
        move.l  $456.w,a0
        move.l  a0,vbl_queue
        move.l  (a0),old_vbl
        move.l  #spectrum_vbl,(a0)
        move.w  (sp)+,sr
        rts
remove_display:
        move.w  sr,-(sp)
        move.w  #$2700,sr
        move.l  vbl_queue,a0
        move.l  old_vbl,(a0)
        move.w  (sp)+,sr
        rts

save_hardware:
        move.b  $ffff820a.w,old_sync
        move.b  $ffff820d.w,old_base_low
        move.b  $ffff820f.w,old_line_width
        move.b  $ffff8265.w,old_scroll
        lea     $ffff8240.w,a0
        lea     old_palette,a1
        moveq   #7,d0
.save:
        move.l  (a0)+,(a1)+
        dbf     d0,.save
        rts

restore_hardware:
        move.b  old_sync,$ffff820a.w
        move.b  old_base_low,$ffff820d.w
        move.b  old_line_width,$ffff820f.w
        move.b  old_scroll,$ffff8265.w
        lea     old_palette,a0
        lea     $ffff8240.w,a1
        moveq   #7,d0
.restore:
        move.l  (a0)+,(a1)+
        dbf     d0,.restore
        rts

        include "limited-raster.s"
        include "limited-sprite.s"
        include "assets/limited-sprite-code.s"
        include "assets/limited-restore-code.s"
reuse_code:         incbin "assets/limited-reuse-code.bin"

        data
mouse_off:          dc.b 18
mouse_on:           dc.b 8
        even
pending_view:       dc.w -1
back_old_y:         dc.w -1
front_old_y:        dc.w -1
back_old_x:         dc.w 0
front_old_x:        dc.w 0
ball_x:            dc.w 144
ball_y:            dc.w 84
velocity_x:        dc.w 3
velocity_y:        dc.w 2
paused:            dc.w 0
frame_count:       dc.l 0
display_palettes_pointer: dc.l 0
display_sprite_tail: dc.l 0
vbl_counter:        dc.l 0
limited_screen:     incbin "assets/limited-background.bin"
limited_palettes:   incbin "assets/limited-background-stream.bin"
sprite_palette_stream: incbin "assets/limited-sprite-stream.bin"
reuse_index:        incbin "assets/limited-reuse-index.bin"
reuse_patches:      incbin "assets/limited-reuse-patches.bin"
        even
reuse_group_offsets:
group_row set 0
        rept 32
        dc.w group_row*160,group_row*160+8,group_row*160+16
group_row set group_row+1
        endr

        bss
old_resolution:     ds.w 1
old_sync:           ds.b 1
old_base_low:       ds.b 1
old_line_width:     ds.b 1
old_scroll:         ds.b 1
old_physbase:       ds.l 1
old_logbase:        ds.l 1
old_palette:        ds.w 16
screen_base:        ds.l 1
front_screen:       ds.l 1
back_screen:        ds.l 1
front_palettes:     ds.l 1
back_palettes:      ds.l 1
vbl_queue:          ds.l 1
old_vbl:            ds.l 1
screen_storage:     ds.b 64000+255
        even
        ds.l 512
stack_top:
        end
